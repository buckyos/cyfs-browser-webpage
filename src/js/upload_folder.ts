import * as cyfs from '../cyfs_sdk/cyfs'
import { toast } from './lib/toast.min'
import { ObjectUtil, formatDate, getSubStr, hasPC, castToLocalUnit } from './lib/util'

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

var g_path: string | undefined = '';
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

class FileInfo {
    m_sharedStatck: cyfs.SharedCyfsStack;
    constructor() {
        this.m_sharedStatck = cyfs.SharedCyfsStack.open_runtime(cyfs.get_system_dec_app().object_id);
    }
    
    async getFilePath() {
        let root_state = this.m_sharedStatck.root_state_accessor_stub();
        let path:string = g_path ? '/' + g_path : '';
        console.origin.log('path', path);
        let lr = await root_state.list('/cyfs_file_upload' + path);
        console.origin.log('lr', lr);
        if (lr.err) {
            console.origin.log('lr-err', lr);
            return;
        }
        let list = lr.unwrap();
        console.origin.log('list',  list);
        let trHtml:string = '';
        for (let [key, value] of list.entries()) {
            let uploadNameR = value.map.key;
            let uploadR = value.map.value;
            let fileName = uploadNameR.substring(uploadNameR.indexOf('_')+1, uploadNameR.length);
            let id = uploadR.to_base_58();
            console.origin.log('fileName, obj_type_code', fileName, uploadR.obj_type_code());
            const retObject = await ObjectUtil.getObject({ id: id, isReturnResult: true });
            let time:string = '';
            if (!retObject.err) {
                time = formatDate(cyfs.bucky_time_2_js_time(retObject.object_update_time));
            }
            let iconName = 'table_dir_icon';
            let type:string = 'dir';
            let dataPath:string = '';
            if(uploadR.obj_type_code() == cyfs.ObjectTypeCode.File){
                type = 'file';
                let suffix = (fileName.split('.'))[fileName.split('.').length - 1].toLowerCase();
                iconName = await returnFormat(suffix);

            }
            if(g_path){
                dataPath = g_path + '/' + fileName;
            }else{
                dataPath = id + '_' + fileName;
            }
            trHtml  +=  `<tr>
                            <td><i class="folder_object_table_icon ${iconName}"></i><span class="href_entrance dir_id_ellipsis " data-id="${id}" data-type="${type}"  data-path="${dataPath}">${fileName}</span></td>
                            <td><span style="float:left">${id}</span><i class="info_main_copy_svg copy_id_icon" data-id="${id}">&nbsp;</i></td>
                            <td>${time}</td>
                            <td>1.2M</td>
                            <td></td>
                        </tr>`;
        }
        $('.folder_object_container').css('display', 'block');
        $('#folder_object_tbody').html(trHtml);
    }
}

const file_info = new FileInfo();
file_info.getFilePath();

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



