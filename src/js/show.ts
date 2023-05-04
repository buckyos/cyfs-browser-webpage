import * as cyfs from '../cyfs_sdk/cyfs'
const QRCode = require('qrcode')
import { ObjectUtil, formatDate, getSubStr, hasPC, castToLocalUnit } from './lib/util'
var console = {
    log:function(param1?:any,param2?:any,param3?:any,param4?:any,param5?:any,param6?:any,param7?:any) {}
}
var ISPC = hasPC();
if (!ISPC && window.location.pathname == '/show.html') {
    console.log('window.location', window.location)
    window.location.href = 'cyfs://static/mobile/show.html' + window.location.search
}

$.ajax({
    url: 'http://127.0.0.1:38090/status',
    success:function(result){
        console.log('getStatus-result', result);
        if(result.anonymous){
            $('.anonymous_box').css('display', 'block');
        }
    }
});

var file_id: cyfs.ObjectId;
var file_id_str: cyfs.ObjectId | string = '';
var target_id: cyfs.ObjectId | undefined = undefined;
var target_id_str: string | undefined = undefined;
var req_path: string | undefined = undefined;
var dec_id: cyfs.ObjectId | undefined = undefined;
var dec_id_str: string | undefined = undefined;
var file_name: string = '';
var device_id: cyfs.ObjectId | undefined = undefined;
var window_inner_path: string | undefined = undefined;
var download_id: cyfs.ObjectId | string | undefined = undefined;
var obj_type: string | undefined = undefined;
var tx_list: cyfs.SPVTx[] = [];
var tx_id: cyfs.ObjectId | string = '';
if (window.location.search.split("?")[1]) {
    let str = window.location.search.split("?")[1];
    if (str.indexOf('&') > -1) {
        let arr = str.split('&');
        if (arr) {
            for (let i = 0; i < arr.length; i++) {
                if (arr[i].indexOf('=') > -1 && arr[i].split('=')[1] && arr[i].split('=')[0] == 'id') {
                    file_id_str = arr[i].split('=')[1];
                }
                if (arr[i].indexOf('=') > -1 && arr[i].split('=')[0] == 'target' && arr[i].split('=')[1]) {
                    target_id_str = arr[i].split('=')[1];
                }
                if (arr[i].indexOf('=') > -1 && arr[i].split('=')[0] == 'req_path' && arr[i].split('=')[1]) {
                    req_path = arr[i].split('=')[1];
                }
                if (arr[i].indexOf('=') > -1 && arr[i].split('=')[0] == 'dec_id' && arr[i].split('=')[1]) {
                    dec_id_str = arr[i].split('=')[1];
                }
                if (arr[i].indexOf('=') > -1 && arr[i].split('=')[0] == 'file_name' && arr[i].split('=')[1]) {
                    file_name = arr[i].split('=')[1];
                    file_name = decodeURI(file_name)
                }
                if (arr[i].indexOf('=') > -1 && arr[i].split('=')[0] == 'inner_path' && arr[i].split('=')[1]) {
                    window_inner_path = arr[i].split('=')[1];
                    window_inner_path = decodeURI(window_inner_path)
                }
                if (arr[i].indexOf('=') > -1 && arr[i].split('=')[0] == 'download_id' && arr[i].split('=')[1]) {
                    download_id = arr[i].split('=')[1];
                }
                if (arr[i].indexOf('=') > -1 && arr[i].split('=')[0] == 'obj_type' && arr[i].split('=')[1]) {
                    obj_type = arr[i].split('=')[1];
                }
            }
        }
    } else {
        if (str.indexOf('=') > -1) {
            let strArr = str.split('=');
            if (strArr) {
                file_id_str = strArr[strArr.length - 1];
            }
        } else {
            file_id_str = str;
        }
    }
    var idErr = false;
    console.log('file_id', file_id_str, target_id_str, req_path, dec_id_str, download_id)
    if (target_id_str) {
        let targetResult = cyfs.ObjectId.from_base_58(target_id_str)
        if (targetResult.err) {
            idErr = true;
        } else {
            target_id = targetResult.unwrap();
        }
    }
    if (typeof (file_id_str) == 'string') {
        let fileIdResult = cyfs.ObjectId.from_base_58(file_id_str)
        if (fileIdResult.err) {
            idErr = true;
        } else {
            file_id = fileIdResult.unwrap();
        }
    } else {
        file_id = file_id_str;
    }
    if (dec_id_str) {
        let decIdResult = cyfs.ObjectId.from_base_58(dec_id_str)
        if (decIdResult.err) {
            idErr = true;
        } else {
            dec_id = decIdResult.unwrap();
        }
    }
    if (download_id && typeof (download_id) == 'string') {
        let downloadIdResult = cyfs.ObjectId.from_base_58(download_id)
        if (downloadIdResult.err) {
            idErr = true;
        } else {
            download_id = downloadIdResult.unwrap();
        }
    }
    if (idErr) {
        $('.no_object_container').css('display', 'block');
        alert('id格式错误')
    }
}
console.log('-----file_name:', file_name)
let OWNER_ID = null;


$("#folder_object_tbody").on("click", ".download_click", function (e) {
    let id = $(this).attr("data-id") || '';
    const name = $(this).attr("data-name") || '';
    const path = $(this).attr("data-path") || '';
    id != 'null' ? id : id = file_id?.toString();
    console.log('download', id, name, path)
    file_info.downloadFile(id, name, path, false);
})

$(".file_download_btn").on("click", function () {
    let path = window_inner_path ? window_inner_path : '*/' + file_name;
    console.log('download', file_id?.toString(), decodeURI(file_name!), path)
    file_info.downloadFile(file_id?.toString(), file_name, path, false);
})

class FileInfo {
    m_sharedStatck: cyfs.SharedCyfsStack;
    m_router: cyfs.NONRequestor;
    m_util_service: cyfs.UtilRequestor;
    m_trans: cyfs.TransRequestor;
    m_ndn_router: cyfs.NDNRequestor;
    constructor() {
        this.m_sharedStatck = cyfs.SharedCyfsStack.open_runtime(cyfs.get_system_dec_app().object_id);
        this.m_router = this.m_sharedStatck.non_service();
        this.m_trans = this.m_sharedStatck.trans();
        this.m_util_service = this.m_sharedStatck.util();
        this.m_ndn_router = this.m_sharedStatck.ndn_service();
    }
    async getDeviceInfo() {
        // Device静态信息
        let current_device_static_info = await this.m_util_service.get_device_static_info({ common: { flags: 0 } });
        if (!current_device_static_info.err) {
            current_device_static_info = current_device_static_info.unwrap().info;
        }
        console.log('current_device_static_info', current_device_static_info)
        device_id = current_device_static_info.device_id
    }

    async initDatas() {
        console.log('file_id', file_id, file_id.obj_type_code(), target_id)
        let flags = 0;
        let inner_path = '';
        if ((file_id && file_id.obj_type_code() == 9)) {
            flags = cyfs.CYFS_REQUEST_FLAG_LIST_DIR;
            inner_path = window_inner_path ? window_inner_path : '/*';
        }
        const retObject = await ObjectUtil.getObject({ inner_path: inner_path, flags: flags, target: target_id, id: file_id, req_path: req_path, dec_id: dec_id, isReturnResult: true });
        if (retObject.err) {
            $('.no_object_container').css('display', 'block');
            return;
        }
        let typeCode = retObject.object.object.desc().obj_type_code();
        console.log('retObject', retObject, retObject.object.object.body(), retObject.object.object.desc());
        tx_id = retObject.object.object_id;

        let object_info = retObject.object.object.desc();
        let create_time = null;
        if (retObject.object.object.desc().create_time().length) {
            create_time = formatDate(cyfs.bucky_time_2_js_time(object_info.create_time()));
        } else {
            create_time = object_info.create_time();
        }
        let crumbs = '';
        let back_html = 'data-path="null"';
        if (inner_path) {
            if (inner_path == '/*') {
                crumbs = (obj_type == 'detail' ? '<span class="dir_crumbs" data-path="/*">根目录</span>/' : '<span>根目录 /</span>');
            } else {
                let path_list = inner_path.split('/');
                if (path_list.indexOf('') > -1) {
                    path_list.splice(path_list.indexOf(''), 1);
                }
                console.log('---path_list', path_list);
                if (path_list.length) {
                    crumbs = `<span class="dir_crumbs" data-path="/*">根目录</span>`;
                    let data_path = '/';
                    path_list.forEach((path, index) => {
                        console.log('---path', path);
                        if (path) {
                            data_path += '/' + path;
                            if (index < path_list.length - 1) {
                                crumbs += `/<span class="dir_crumbs" data-path="${data_path}">${getSubStr(path, 2)}</span>`;
                                if (path_list.length >= 2 && index == path_list.length - 2) {
                                    back_html = `data-path="${data_path}"`;
                                }
                            } else {
                                if (path_list.length == 1) {
                                    back_html = `data-path="/*"`;
                                    data_path = "/*";
                                }
                                if (obj_type == 'file' && typeCode != 8) {
                                    crumbs += `/<span>${getSubStr(path, 2)}</span>`;
                                } else {
                                    crumbs = `<div class="last_title_p">` + crumbs;

                                    crumbs += `/<span class="dir_crumbs" data-path="${data_path}">${getSubStr(path, 2)}</span>/<span>详情</span></div><span class="last_title_span">${path}</span><i class="file_back dir_crumbs" ${back_html} title="返回"></i>`
                                }
                            }
                        }
                    })
                }
            }
        }
        console.log('---crumbs', crumbs);
        if (typeCode == 8) {
            // 展示图片
            $('.file_object_box').css('display', 'block');
            document.getElementById('create_time_info')!.innerHTML = create_time;
            $('#header_titile_name').html(crumbs ? crumbs : file_name);
            showPicture(object_info, inner_path);
        } else if (typeCode == 9) {
            console.log('---obj_type, inner_path', obj_type, inner_path)
            showDir(create_time, inner_path, crumbs, back_html, object_info, retObject);
        } else if (typeCode == 16) {
            $('.file_object_box').css('display', 'block');
            $('#object_info_div').css('display', 'none');
            showMsg(retObject);
        } else {
            $('.no_object_container').css('display', 'block');
        }
        let author = null;
        if (object_info.author()) {
            author = object_info.author()
        } else if (object_info.owner() && object_info.owner()) {
            author = object_info.owner();
        }
        if (object_info.owner() && object_info.owner()) {
            OWNER_ID = object_info.owner();
            author = author ? author : OWNER_ID;
            document.getElementById('owner_info')!.innerHTML = '拥有者：' + OWNER_ID;
        }
        document.getElementById('author_info')!.innerHTML = author;
        file_info.getDeviceInfo();
        let scanCode = document.querySelector("#scan_code");
        QRCode.toCanvas(scanCode, tx_id.toString(), {
            errorCorrectionLevel: 'L',
            width: 107,
            height: 112,
            margin: 0
        });
        meta_client.getCollectTxList()
        meta_client.getBalanceInfo()
    }

    async getNodeTree(isRoot: boolean, name: string, object_info: cyfs.AnyNamedObject | any, body_info: null, object_data: cyfs.Dir) {
        let result = null;
        let mapDatas = null;
        if (isRoot) {
            result = object_info;
            if (!object_info.content().obj_list().info.obj_list) {
                let chunk_object_id = (cyfs.ObjectId.from_base_58(result.content().obj_list().info.chunk_id.to_base_58())).unwrap()
                console.log('chunk_object_id:', chunk_object_id)
                let get_body_data_result = object_data.get_data_from_body(chunk_object_id);
                console.log('get_body_data:', get_body_data_result)
                if (get_body_data_result.unwrap()) {
                    let get_body_data = get_body_data_result.unwrap();
                    var body_list_data = ((new cyfs.NDNObjectListDecoder()).raw_decode(get_body_data).unwrap())[0].object_map();
                    console.log('body_list_data:', body_list_data)
                    mapDatas = body_list_data;
                } else {
                    // alert('DIR解析失败')
                }
            }
        } else {
            console.log('-----------------name', name)
            result = (await ObjectUtil.getObject({ inner_path: name + '/*', flags: cyfs.CYFS_REQUEST_FLAG_LIST_DIR, target: target_id, id: file_id, req_path: req_path, dec_id: dec_id, isReturnResult: true })).object.object.desc();
        }
        console.log('---result:', result, result.content().obj_list().info)
        if (!mapDatas) {
            mapDatas = result.content().obj_list().info.obj_list.object_map();
        }
        console.log('---mapDatas:', mapDatas)
        let node = []
        let nameArr = []
        for (let [key, value] of mapDatas.entries()) {
            console.log('-----key', key, value)

            const segs = key.value().split('/')
            console.log('-----key', value.node().id.object_id.toString(), segs, value.node())
            let hasChildren = false
            if (segs.length == 1) {
                if (value.node().id.object_id.obj_type_code() == 9) {
                    hasChildren = true
                }
            } else if (segs.length > 1) {
                hasChildren = true
            }
            if (nameArr.indexOf(segs[0]) <= -1) {
                nameArr.push(segs[0])
                let montageName = name ? name + '/' + segs[0] : segs[0]
                node.push({
                    name: segs[0],
                    montageName: montageName,
                    hasChildren: hasChildren,
                    path: montageName,
                    id: value.node().id.object_id.toString()
                })
            }
        }
        console.log('---node:', node)
        return node
    }
    async downloadFile(id: string, name: string, path: string, isGetUrl: boolean) {
        console.log('------------device_id', device_id)
        console.log('------------id, name, path, isGetUrl', name, path)
        let idResult = cyfs.ObjectId.from_base_58(id)
        if (idResult.err) {
            alert('id格式错误')
        } else {
            id = idResult.unwrap();
        }
        if (path === 'null') {
            path = name
        }
        let req: cyfs.NDNGetDataOutputRequest = {
            object_id: file_id,
            inner_path: path,
            common: {
                level: cyfs.NDNAPILevel.Router,
                flags: 0,
                target: target_id,
                req_path: req_path,
                dec_id: dec_id,
                referer_object: []
            }
        }
        console.log('------------req', req)
        const url = this.m_ndn_router.prepare_download_data(req);
        console.log('------------url', url)
        if (isGetUrl) {
            return url;
        } else {
            var a = document.createElement('a');
            a.href = url;
            a.download = name;
            a.click();
            window.URL.revokeObjectURL(url);
        }
    }
}

const file_info = new FileInfo();
file_info.initDatas();

async function showPicture(object_info: cyfs.AnyNamedObject, path: string) {
    console.log('---file_name', file_name)
    if (file_name && !/\.(jpg|jpeg|png|GIF|JPG|PNG)$/.test(file_name)) {
        $('.file_object_box_icon').css('display', 'block');
        let iconName = 'file_object_dir_box';
        let suffix = (file_name.split('.'))[file_name.split('.').length - 1].toLowerCase();
        console.log('---suffix', suffix)
        iconName = await returnFormat(suffix);
        $('.file_object_box_icon').addClass(iconName);
    } else {
        $('#object_info_div').css('display', 'block');
        let imageURL = '';
        if (file_name) {
            imageURL = await file_info.downloadFile(object_info.calculate_id().to_base_58(), file_name, path, true) || '';
        } else {
            imageURL = `cyfs://o/${object_info.calculate_id().to_base_58()}`;
        }
        const image = document.createElement('img');
        image.src = imageURL;
        let imageContainer = document.getElementById('object_info_div')!;
        imageContainer.appendChild(image);
    }
}

async function showMsg(retObject: cyfs.NONGetObjectOutputResponse) {
    if (retObject.object.object?.desc().obj_type() == cyfs.CoreObjectType.Msg) {
        let msg_ret = (new cyfs.MsgDecoder()).raw_decode(new Uint8Array(retObject.object.object_raw));
        console.log('------------msg_ret', msg_ret)
        if (msg_ret.err) {
        } else {
            let [msg,] = msg_ret.unwrap();
            console.log('------------msg', msg)
            msg.desc().content().content.match({
                Text: (text: string) => {
                    document.getElementById('object_info_div')!.innerHTML = `<div style="text-align:left">${text}</div>`;
                }
            });
        }
    }
}

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


async function showDir(create_time: string, inner_path: string, crumbs: string, back_html: string, object_info: cyfs.NONObjectInfo | any, retObject: cyfs.NONGetObjectOutputResponse | any) {
    if (obj_type == 'detail') {
        $('.file_object_box').css('display', 'block');
        $('.file_object_box_icon').css('display', 'block');
        $('.file_download_btn').css('display', 'none');
        $('.file_object_box_icon').addClass('file_object_dir_box');
        document.getElementById('create_time_info')!.innerHTML = create_time;
        $('#header_titile_name').html(crumbs)
    } else if (obj_type == 'file') {
        $('.folder_object_container').css('display', 'block');
        console.log('object_info.content().obj_list().info.obj_list', object_info.content().obj_list().info.obj_list)
        crumbs += `<i class="file_back dir_crumbs" ${back_html} title="返回"></i>`;
        $('.folder_object_title').html(crumbs)
        let TreeData = await file_info.getNodeTree(true, '', object_info, retObject.object.object.body(), retObject.object.object)
        console.log('---TreeData', TreeData)
        let trHtml = '';
        if (TreeData) {
            for (let i = 0; i < TreeData.length; i++) {
                let data = TreeData[i];
                let operation = `<td><span class="folder_object_table_click href_entrance" data-id="${file_id}" data-type="detail" data-path="${inner_path == '/*' ? '/' + data.montageName : inner_path + '/' + data.montageName}">详情</span></td>`;
                let iconName = 'table_dir_icon';
                if (!data.hasChildren) {
                    operation = `<td><span class="folder_object_table_click download_click" data-id="${file_id}" data-type="detail" data-name="${data.name}" data-path="${inner_path == '/*' ? '/' + data.montageName : inner_path + '/' + data.montageName}">下载</span></td>`;
                    let suffix = (data.name.split('.'))[data.name.split('.').length - 1].toLowerCase();
                    console.log('---suffix', suffix)
                    iconName = await returnFormat(suffix);
                }
                trHtml += `<tr>
                                <td><i class="folder_object_table_icon ${iconName}"></i><span class="href_entrance dir_id_ellipsis " data-id="${data.id}" data-type="file" data-path="${inner_path == '/*' ? '/' + data.montageName : inner_path + '/' + data.montageName}" ${data.hasChildren ? '' : 'data-key="' + data.name + '"'}>${data.name}</span></td>
                                <td>${create_time}</td>
                                ${operation}
                            </tr>`;
            }
        }

        $('#folder_object_tbody').html(trHtml);
    } else {
        $('.folder_object_container').css('display', 'block');
        let trHtml = `<tr>
                            <td><i class="folder_object_table_icon table_dir_icon"></i><span class="dir_id_ellipsis href_entrance" data-id="${file_id}" data-type="file">${file_id}</span></td>
                            <td>${create_time}</td>
                            <td><span class="folder_object_table_click href_entrance" data-id="${file_id}" data-type="detail">详情</span></td>
                        </tr>`;
        $('#folder_object_tbody').html(trHtml);
    }
}
class MetaClient {
    meta_client: cyfs.MetaClient;
    constructor() {
        // 空参数或'test'为测试链，传'dev'为正式链
        this.meta_client = cyfs.create_meta_client();
    }
    // 获取余额
    async getBalanceInfo() {
        document.getElementById('balance_dom2')!.innerHTML = castToLocalUnit((await this.meta_client.getFileRewardAmount(tx_id.toString())).result) + ' DMC';
    }
    // 获取转账列表
    async getCollectTxList() {
        let txLists = (await this.meta_client.getCollectTxList([tx_id.toString()], 0, 10000, null, null, ["0", "1"]))?.result;
        // console.log('获取转账列表:', txLists)
        if (txLists?.length) {
            $('.file_reward_record_title').css('display', 'block');
            $('.file_no_reward_record').css('display', 'none');
            let liHtml = '';
            tx_list = txLists;
            txLists.forEach((element, index) => {
                if (index < 5) {
                    liHtml += `<li>${getSubStr(element.from)}打赏了${castToLocalUnit(Number(element.value))}DMC ${formatDate(Number(element.create_time))}</li>`
                }
            });
            $('.file_reward_record_list').html(liHtml)
        } else {
            $('.file_reward_record_title').css('display', 'none');
            $('.file_no_reward_record').css('display', 'block');
        }
    }
}
const meta_client = new MetaClient();

setInterval(function () { meta_client.getBalanceInfo() }, 60000);
setInterval(function () { meta_client.getCollectTxList() }, 60000);

$('#folder_object_tbody').on('click', ".href_entrance", function () {
    const hrefStr = $(this).attr("data-id") || '';
    const path = $(this).attr("data-path") || '';
    const name = $(this).attr("data-key") || '';
    const type = $(this).attr("data-type") || '';
    routeToNext(hrefStr, path, name, type)
})

$('.folder_object_title, .header_titile_name').on('click', ".dir_crumbs", function () {
    const path = $(this).attr("data-path") || '';
    if (path == 'null' || path == 'undefined') {
        routeToNext('', '', '', '')
    } else {
        let type = 'file'
        routeToNext('', path, '', type)
    }
})
function routeToNext(hrefStr: string, path: string, name: string, type: string) {
    console.log('hrefStr, path, name, type', hrefStr, path, name, type)
    let localtion_path = ''
    let str = window.location.search.split("?")[1];
    if (str.indexOf('&') > -1) {
        localtion_path = 'id=' + file_id;
        path ? localtion_path += '&inner_path=' + path : '/';
        target_id ? localtion_path += '&target=' + target_id : '';
        req_path ? localtion_path += '&req_path=' + req_path : '';
        dec_id ? localtion_path += '&dec_id=' + dec_id : '';
        name ? localtion_path += '&file_name=' + name : '';
        hrefStr ? localtion_path += '&download_id=' + hrefStr : '';
        type ? localtion_path += '&obj_type=' + type : '';
    } else {
        localtion_path = 'id=' + hrefStr + '&file_name=' + name;
    }
    console.log('localtion_path', localtion_path)
    window.open("show.html?" + localtion_path);
}

$('.file_reward_record_container').on('click', ".open_file_reward_record", function () {
    if (tx_list?.length > 5) {
        $('.open_file_reward_record').addClass('close_file_reward_record').removeClass('open_file_reward_record');
        let liHtml = '';
        tx_list.forEach(element => {
            liHtml += `<li>${getSubStr(element.from)}打赏了${castToLocalUnit(Number(element.value))}DMC ${formatDate(Number(element.create_time))}</li>`
        });
        $('.file_reward_record_list').html(liHtml)
    }
})

$('.file_reward_record_container').on('click', ".close_file_reward_record", function () {
    if (tx_list.length > 5) {
        $('.close_file_reward_record').addClass('open_file_reward_record').removeClass('close_file_reward_record');
        let liHtml = '';
        tx_list.forEach((element, index) => {
            if (index < 5) {
                liHtml += `<li>${getSubStr(element.from)}打赏了${castToLocalUnit(Number(element.value))}DMC ${formatDate(Number(element.create_time))}</li>`
            }
        });
        $('.file_reward_record_list').html(liHtml)
    }
})

