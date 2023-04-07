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
    localStorage.removeItem('is-init-show-guide');
    window.open('https://browser.cyfs.com/init.html');
})

let g_path: string | undefined = '';
let g_decid: cyfs.ObjectId | undefined = '';
let g_owner: cyfs.ObjectId | undefined = '';
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
            for (let i = 0; i < arr.length; i++) {
                if (arr[i].indexOf('=') > -1 && arr[i].split('=')[1] && arr[i].split('=')[0] == 'owner') {
                    let owner:string | undefined = arr[i].split('=')[1];
                    let idRet = cyfs.ObjectId.from_base_58(owner);
                    if (idRet.err) {
                        toast({
                        message: 'id error',
                        time: 1500, 
                        type: 'warn'
                        });
                    } else {
                        g_owner = idRet.unwrap();
                    }
                }
            }
            for (let i = 0; i < arr.length; i++) {
                if (arr[i].indexOf('=') > -1 && arr[i].split('=')[1] && arr[i].split('=')[0] == 'decid') {
                    let decid:string | undefined = arr[i].split('=')[1];
                    let idRet = cyfs.ObjectId.from_base_58(decid);
                    if (idRet.err) {
                        toast({
                        message: 'dec id error',
                        time: 1500, 
                        type: 'warn'
                        });
                    } else {
                        g_decid = idRet.unwrap();
                    }
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
console.log('g_path, g_owner, g_decid', g_path, g_owner, g_decid)

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

export function getSubStr(str:string|undefined) {
    if (str) {
        str = str?.toString();
        var subStr1: string = str.length > 20 ? str.substr(0, 20) + '...' : str;
        return subStr1;
    } else {
        return '';
    }
  }

class FileInfo {
    m_sharedStatck: cyfs.SharedCyfsStack;
    m_util_service: cyfs.UtilRequestor;
    m_ndn_service: cyfs.NDNRequestor;
    constructor() {
        this.m_sharedStatck = cyfs.SharedCyfsStack.open_runtime(cyfs.get_system_dec_app().object_id);
        this.m_util_service = this.m_sharedStatck.util();
        this.m_ndn_service = this.m_sharedStatck.ndn_service();
    }

    async getList(id: string, fileName:string ,obj_type_code: number, root_state: cyfs.GlobalStateAccessorStub){
        let path:string = g_path + '/' + fileName;
        let retObject = await root_state.get_object_by_path(path);
        if (!retObject.err) {
            let retR = retObject.unwrap();
            let time:string = formatDate(cyfs.bucky_time_2_js_time(retR.object_update_time));
            let iconName = 'table_dir_icon';
            let type:string = 'dir';
            let size:string = '';
            if(obj_type_code == cyfs.ObjectTypeCode.File){
                type = 'file';
                let suffix = (fileName.split('.'))[fileName.split('.').length - 1].toLowerCase();
                iconName = await returnFormat(suffix);
                size = getfilesize(Number(retR.object.object.desc().content().len.toString()), true);
            }
            let item: g_tableDataType = {
                dataPath: g_path + '/' + fileName,
                iconName: iconName,
                id: id,
                type: type,
                fileName: fileName,
                updateTime: retR.object_update_time,
                time: time,
                size: size
            };
            return item;
        }
    }
    
    async getFilePath() {
        let root_state = this.m_sharedStatck.root_state_accessor_stub(g_owner, g_decid);
        console.origin.log('root_state', root_state);
        let path:string = g_path + '/';
        console.origin.log('path', path);
        let isFile:boolean = false;
        if(g_path){
            let pathId =  g_path;
            console.log('pathId', pathId)
            let pathIdR = await root_state.get_object_by_path(pathId);
            console.origin.log('pathIdR', pathIdR);
            if(!pathIdR.err){
                $('.folder_object_subtitle').html(pathIdR.unwrap().object.object_id.to_base_58());
                if(pathIdR.unwrap().object.object.obj_type_code() == cyfs.ObjectTypeCode.File){
                    isFile = true;
                    window.location.href = `cyfs://r/${g_owner}/${g_decid}/${g_path}`;
                }
            }
        }
        let lr: cyfs.Result = await root_state.list(path);
        console.origin.log('lr', lr);
        if (lr.err) {
            if(!isFile){
                $('.no_object_container').css('display', 'block');
            }
            return;
        }
        let list = lr.unwrap();
        let crumbs:string = '';
        if(g_path){
            let pathList = decodeURIComponent(g_path).split('/');
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
                crumbs += `<span class="dir_crumbs" data-path="${crumbPath}"> ${decodeURIComponent(name)} </span>/`;
            });
            $('title').html('CYFS-'+decodeURIComponent(crumbPath));
        }
        let trHtml:string = '';
        let dataList:g_tableDataType[] = [];
        let i:number = 0;
        let getListPromise:Promise<g_tableDataType|undefined>[] = [];
        for (let [key, value] of list.entries()) {
            let uploadNameR = value.map.key;
            let uploadR = value.map.value;
            let id = uploadR.to_base_58();
            let fileName:string = '';
            if(g_path){
                fileName = decodeURIComponent(uploadNameR);
            }else{
                fileName = decodeURIComponent(uploadNameR.substring(uploadNameR.indexOf('_')+1, uploadNameR.length));
            }
            getListPromise.push(this.getList(id, fileName, uploadR.obj_type_code(),root_state))
        }
        if(getListPromise){
            Promise.allSettled(getListPromise).then((list) => {
                list.forEach((item, index) => {
                    if(item.status == 'fulfilled' && item.value){
                        dataList.push(item.value);
                    }
                });
                dataList.sort(function(a,b){
                    if(a!.updateTime > b!.updateTime) return -1;
                    if(a!.updateTime < b!.updateTime) return 1;
                    return 0;
                });
                console.origin.log('dataList', dataList);
                totalData = dataList;
                totalPage = dataList.length/10;
                let pageHtml:string = '';
                for (let index = 1; index < totalPage; index++) {
                    pageHtml += `<span>${index+1}</span>`;
                }
                $('#page_div').append(pageHtml)
                $('.folder_object_title').html(g_path?crumbs:'File list');
                this.renderList();
            });
        }
        
    }

    async renderList() {
        let trHtml:string = '';
        if(totalPage == currentPage - 1){
            return;
        }
        let dataList = totalData.slice(currentPage * 10, (currentPage + 1) * 10);
        dataList.forEach(element => {
            trHtml  +=  `<tr>
                            <td><i class="folder_object_table_icon ${element.iconName}"></i><span class="href_entrance dir_id_ellipsis " data-id="${element.id}" data-type="${element.type}"  data-path="${element.dataPath}"  data-key="${element.fileName}" title="${element.fileName}">${getSubStr(element.fileName)}</span></td>
                            <td ><span style="float:left" title="${element.id}">${getSubStr(element.id)}</span><i class="info_main_copy_svg copy_id_icon" data-id="${element.id}">&nbsp;</i></td>
                            <td>${element.time}</td>
                            <td>${element.size}</td>
                            <td>${element.type=='file'?`<button class="download_btn" data-id="${element.id}" data-path="${element.dataPath}" data-name="${element.fileName}">下载</button>`:''}</td>
                        </tr>`;
        });
        $('.folder_object_container').css('display', 'block');
        $('#folder_object_tbody').html(trHtml);
    }

    async getDeviceId (id: cyfs.ObjectId) {
        let req: cyfs.UtilResolveOODRequest = {
            object_id:id,
            owner_id: g_owner,
            common:{
                flags: 1,
            }
        }
        let resolveOodR = await this.m_util_service.resolve_ood(req);
        if(!resolveOodR.err){
            let deviceList: cyfs.ObjectId[] = resolveOodR.unwrap().device_list;
            if(deviceList){
                let deviceId: cyfs.ObjectId = resolveOodR.unwrap().device_list[0].object_id;
                return deviceId;
            }
        }
        return undefined;
    }

    async getUrlDownload(id: string, path:string, name:string){
        try{
            let object_id:cyfs.ObjectId|undefined = await ObjectUtil.objectIdFormat(id);
            if(object_id){
                let deviceId: cyfs.ObjectId | undefined = await this.getDeviceId(object_id);
                let req:cyfs.NDNGetDataOutputRequest={
                    object_id: object_id,
                    inner_path:path,
                    common: {
                        flags: 1,
                        target: deviceId,
                        level: cyfs.NDNAPILevel.NDN, 
                        dec_id: g_decid
                    }
                }
                let getDataR = await this.m_ndn_service.get_data(req);
                console.origin.log('----------getDataR', getDataR);
                if(!getDataR.err){
                    let getData = getDataR.unwrap().data;
                    var a = window.document.createElement("a");
                    var blob = new Blob([getData]);
                    a.href = window.URL.createObjectURL(blob);
                    a.download =name;
                    document.body.appendChild(a);
                    a.click();  
                    document.body.removeChild(a);
                    $('.loading_cover_div').css('display', 'none');
                }
            }
        }catch{
            $('.loading_cover_div').css('display', 'none');
        }
        
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

$('#page_div').on('click', 'span', function() {
    currentPage = $(this).index();
    file_info.renderList();
    $('#page_div span').eq(currentPage).addClass('choose_index').siblings().removeClass("choose_index");
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
        console.log('111111111111111111111')
        window.open(`cyfs://r/${g_owner}/${g_decid}/${g_path + '/' + name}`);
    }else{
        window.location.href = `cyfs://static/view_objectmap.html?owner=${g_owner}&decid=${g_decid}&path=${path}`;
    }
}

$('#folder_object_tbody').on('click', ".download_btn", function () {
    $('.loading_cover_div').css('display', 'block');
    const path = $(this).attr("data-path") || '';
    const id = $(this).attr("data-id") || '';
    const name = $(this).attr("data-name") || '';
    if(path && id && name){
        file_info.getUrlDownload(id, path, name);
    }
})

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
    window.location.href = `cyfs://static/view_objectmap.html?owner=${g_owner}&decid=${g_decid}&path=${path}`;
})

$('.order_icon_box').on('click', function () {
    let isUp = $('.order_icon').hasClass('up_order');
    console.origin.log('isUp', isUp);
    currentPage = 0;
    if(isUp){
        totalData.sort(function(a,b){
            if(a!.updateTime > b!.updateTime) return 1;
            if(a!.updateTime < b!.updateTime) return -1;
            return 0;
        });
        $('.order_icon').removeClass('up_order').addClass('down_order');
    }else{
        totalData.sort(function(a,b){
            if(a!.updateTime > b!.updateTime) return -1;
            if(a!.updateTime < b!.updateTime) return 1;
            return 0;
        });
        $('.order_icon').removeClass('down_order').addClass('up_order');
    }
    $('#page_div').css('left', '0px')
    $('#page_div span').eq(0).addClass('choose_index').siblings().removeClass("choose_index");
    file_info.renderList();
})
