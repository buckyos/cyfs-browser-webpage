import * as cyfs from '../cyfs_sdk/cyfs'
import { toast } from './lib/toast.min'
import { ObjectUtil, formatDate } from './lib/util'

$.ajax({
    url: 'http://127.0.0.1:38090/status',
    success:function(result){
        console.log('getStatus-result', result);
        if(result.anonymous){
            $('.anonymous_box').css('display', 'block');
        }
    }
});

$('.anonymous_subtitle').on('click', async function () {
    window.open('cyfs://static/guide.html');
})

let g_path: string | undefined = '';
export type g_tableDataType = {
    dataPath: string,
    iconName: string,
    id: string,
    type: string,
    fileName: string,
    time: string,
    updateTime: number,
    size: string
};
let totalPage: number = 0;
let currentPage: number = 0;
let totalData:g_tableDataType[] = [];
if (window.location.search.split("?")[1]) {
    let str = window.location.search.split("?")[1];
    if (str.indexOf('&') > -1) {
        let arr = str.split('&');
        if (arr) {
            for (let i = 0; i < arr.length; i++) {
                if (arr[i].indexOf('=') > -1 && arr[i].split('=')[1] && arr[i].split('=')[0] == 'path') {
                    g_path = arr[i].split('=')[1];
                }
            }
        }
    } else {
        if (str.indexOf('=') > -1) {
            let strArr = str.split('=');
            if (strArr) {
                g_path = strArr[strArr.length - 1];
            }
        } else {
            g_path = str;
        }
    }
}
console.log('g_path', g_path)

function getfilesize(size: number, isByte?: boolean) {
    if (!size)
        return "0KB";
    let num = 1024.00; // KB
    if(isByte){
        if(size < num){
            return size.toFixed(0) + "B";
        }else{
            size = size/1024;
        }
    }
    if (size < num)
        return size.toFixed(0) + "KB";
    if (size < Math.pow(num, 2))
        return (size / num).toFixed(0) + "MB"; // MB
    if (size < Math.pow(num, 3))
        return (size / Math.pow(num, 2)).toFixed(0) + "G"; // G
    // if (size < Math.pow(num, 4))
    else
        return (size / Math.pow(num, 3)).toFixed(0) + "T"; // T
}

class FileInfo {
    m_sharedStatck: cyfs.SharedCyfsStack;
    constructor() {
        this.m_sharedStatck = cyfs.SharedCyfsStack.open_runtime(cyfs.get_system_dec_app().object_id);
    }
    
    async getFilePath() {
        let root_state = this.m_sharedStatck.root_state_accessor_stub();
        let path:string = g_path ? '/' + g_path : '';
        console.origin.log('path', path);
        if(g_path){
            let pathId = g_path.substring(0, g_path.indexOf('_'));
            console.origin.log('pathId', pathId);
            const pathIdR = await ObjectUtil.getObject({ id: pathId, isReturnResult: true });
            console.origin.log('pathIdR', pathIdR, pathIdR.object.object.obj_type_code());
            if(!pathIdR.err){
                if(pathIdR.object.object.obj_type_code() == cyfs.ObjectTypeCode.File){
                    window.location.href = " cyfs://r/$$/system/cyfs_file_upload/" + g_path;
                }
            }
        }
        let lr: cyfs.Result = await root_state.list('/cyfs_file_upload' + path);
        console.origin.log('lr', lr);
        if (lr.err) {
            $('.no_object_container').css('display', 'block');
            return;
        }
        let list = lr.unwrap();
        let crumbs:string = '<span class="dir_crumbs" data-path="*/">根目录 </span>/';
        if(g_path){
            let pathList = g_path.split('/');
            if (pathList.indexOf('') > -1) {
                pathList.splice(pathList.indexOf(''), 1);
            }
            let crumbPath:string = '';
            pathList.forEach((pathItem, index) => {
                let name:string = '';
                if(index == 0){
                    name = pathItem.substring(pathItem.indexOf('_')+1, pathItem.length);
                    crumbPath += pathItem;
                }else{
                    name = pathItem;
                    crumbPath += '/' + pathItem;
                }
                crumbs += `<span class="dir_crumbs" data-path="${crumbPath}"> ${decodeURI(name)} </span>/`;
            });
        }
        let trHtml:string = '';
        let dataList:g_tableDataType[] = [];
        let i:number = 0;
        for (let [key, value] of list.entries()) {
            let uploadNameR = value.map.key;
            let uploadR = value.map.value;
            console.log('11111', uploadNameR)
            let fileName:string = '';
            if(g_path){
                fileName = decodeURI(uploadNameR);
            }else{
                fileName = decodeURI(uploadNameR.substring(uploadNameR.indexOf('_')+1, uploadNameR.length));

            }
            let id = uploadR.to_base_58();
            const retObject = await ObjectUtil.getObject({ id: id, isReturnResult: true });
            let time:string = '';
            if (!retObject.err) {
                time = formatDate(cyfs.bucky_time_2_js_time(retObject.object_update_time));
            }
            let iconName = 'table_dir_icon';
            let type:string = 'dir';
            let dataPath:string = '';
            let size:string = '';
            if(uploadR.obj_type_code() == cyfs.ObjectTypeCode.File){
                type = 'file';
                let suffix = (fileName.split('.'))[fileName.split('.').length - 1].toLowerCase();
                iconName = await returnFormat(suffix);
                size = getfilesize(Number(retObject.object.object.desc().content().len.toString()), true);
            }
            if(g_path){
                dataPath = g_path + '/' + fileName;
            }else{
                dataPath = id + '_' + fileName;
            }
            let item: g_tableDataType = {
                dataPath: dataPath,
                iconName: iconName,
                id: id,
                type: type,
                fileName: fileName,
                updateTime: retObject.object_update_time,
                time: time,
                size: size
            };
            dataList.push(item);
            dataList.sort(function(a,b){
                if(a.updateTime > b.updateTime) return -1;
                if(a.updateTime < b.updateTime) return 1;
                return 0;
            });
            i++;
        }
        totalData = dataList;
        totalPage = dataList.length/10;
        let pageHtml:string = '';
        for (let index = 1; index < totalPage; index++) {
            pageHtml += `<span>${index+1}</span>`;
        }
        $('#page_div').append(pageHtml)
        $('.folder_object_title').html(g_path?crumbs:'File list');
        this.renderList();
    }

    async renderList() {
        let trHtml:string = '';
        if(totalPage == currentPage - 1){
            return;
        }
        let dataList = totalData.slice(currentPage * 10, (currentPage + 1) * 10);
        dataList.forEach(element => {
            trHtml  +=  `<tr>
                            <td><i class="folder_object_table_icon ${element.iconName}"></i><span class="href_entrance dir_id_ellipsis " data-id="${element.id}" data-type="${element.type}"  data-path="${element.dataPath}"  data-key="${element.fileName}">${element.fileName}</span></td>
                            <td><span style="float:left">${element.id}</span><i class="info_main_copy_svg copy_id_icon" data-id="${element.id}">&nbsp;</i></td>
                            <td>${element.time}</td>
                            <td>${element.size}</td>
                        </tr>`;
        });
        $('.folder_object_container').css('display', 'block');
        $('#folder_object_tbody').html(trHtml);
    }
}
const file_info = new FileInfo();
file_info.getFilePath();

$('.last_page_btn').on('click', () => {
    if(currentPage > 0){
        currentPage -- ;
        file_info.renderList();
        $('#page_div span').eq(currentPage).addClass('choose_index').siblings().removeClass("choose_index");
        if ($('#page_div').position().left < 0) {
            $('#page_div').css('left', ($('#page_div').position().left + 32) + 'px')
        }
    }
})
$('.next_page_btn').on('click', () => {
    if(totalPage > currentPage + 1){
        currentPage ++ ;
        file_info.renderList();
        $('#page_div span').eq(currentPage).addClass('choose_index').siblings().removeClass("choose_index");
        if ($('#page_div').position().left <= 0 && currentPage > 8) {
            $('#page_div').css('left', ($('#page_div').position().left - 32) + 'px')
        }
    }
})

async function returnFormat(suffix: string) {
    let iconName = '';
    if (['png', 'jpg', 'jpeg', 'bmp', 'gif', 'webp', 'psd', 'svg', 'tiff'].indexOf(suffix) > -1) {
        iconName = 'table_img_icon';
    } else if (['txt'].indexOf(suffix) > -1) {
        iconName = 'table_txt_icon';
    } else if (['mp3', 'wma', 'cda', 'aiff', 'mid', 'flac', 'ape'].indexOf(suffix) > -1) {
        iconName = 'table_music_icon';
    } else if (['pdf'].indexOf(suffix) > -1) {
        iconName = 'table_pdf_icon';
    } else if (['ppt', 'pptx', 'pps', 'ppsx', 'ppa', 'ppam', 'pot', 'potx', 'thmx'].indexOf(suffix) > -1) {
        iconName = 'table_ppt_icon';
    } else if (['doc', 'docx'].indexOf(suffix) > -1) {
        iconName = 'table_word_icon';
    } else if (['xls', 'xlsx', 'xls', 'csv'].indexOf(suffix) > -1) {
        iconName = 'table_excel_icon';
    } else if (['avi', 'rm', 'rmvb', 'mpg', 'mpeg', 'mpe', 'mov', 'mp4', 'm4v', 'mkv', 'swf', 'flv', 'wmv'].indexOf(suffix) > -1) {
        iconName = 'table_video_icon';
    } else {
        iconName = 'table_others_icon';
    }
    return iconName;
}

$('#folder_object_tbody').on('click', ".href_entrance", function () {
    const hrefStr = $(this).attr("data-id") || '';
    const path = $(this).attr("data-path") || '';
    const name = $(this).attr("data-key") || '';
    const type = $(this).attr("data-type") || '';
    routeToNext(hrefStr, path, name, type)
})

function routeToNext(hrefStr: string, path: string, name: string, type: string) {
    if(type == 'file'){
        window.location.href = " cyfs://r/$$/system/cyfs_file_upload/" + hrefStr + '_' + name;
    }else{
        window.open("cyfs://static/upload_folder.html?path=" + path);
    }
}

function copyData (data:string) {
    $('#copy_textarea').text(data).show();
    $('#copy_textarea').select();
    document.execCommand('copy', false, '');
    $('#copy_textarea').hide();
    toast({
        message: 'Copied successfully',
        time: 1500,
        type: 'success'
    });
}

$('#folder_object_tbody').on('click', ".copy_id_icon", function () {
    const id:string = $(this).attr("data-id") || '';
    if(id){
        copyData(id);
    }
})

$('.folder_object_title').on('click', ".dir_crumbs", function () {
    const path = $(this).attr("data-path") || '';
    if (path == 'null' || path == 'undefined' || path == '*/') {
        window.location.href = "cyfs://static/upload_folder.html";
    } else {
        window.location.href = "cyfs://static/upload_folder.html?path=" + path;
    }
})