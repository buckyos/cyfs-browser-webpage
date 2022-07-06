import "../../css/m_main.css"
import * as cyfs from '../../cyfs_sdk/cyfs'
const QRCode = require('qrcode')
import { ObjectUtil, formatDate, getSubStr, hasPC, castToLocalUnit } from '../lib/util'

var ISPC = hasPC();
if (!ISPC && window.location.pathname == '/show.html') {
    console.log('window.location', window.location)
    window.location.href = 'cyfs://static/mobile/show.html' + window.location.search
}
$("#object_info_div").on("click", ".file_li_p", function (e) {
    if ($(e.target).closest('.dir_download').length == 0) {
        $(this).attr("date-key")
        const isOpen = $(this).attr("data-open")
        if ($(this).attr("data-type") == "dir") {
            if (isOpen != "open") {
                openDir($(this), $(this).attr("data-name"))
                $(this).attr("data-open", "open")
            } else {
                closeDir($(this), $(this).attr("data-key"), $(this).attr("data-key"))
                $(this).attr("data-open", "")
            }
        }
        console.log(e)
    }
})

$("#object_info_div").on("click", ".root", (e) => {
    rootClick(e)
})

$("#object_info_div").on("click", ".dir_download", function (e) {
    let id = $(this).attr("data-id")
    const name = $(this).attr("data-name")
    const path = $(this).attr("data-path")
    id != 'null' ? id : id = file_id.to_base_58();
    console.log('download', id, name, path)
    file_info.downloadFile(id, name, path, false);
})
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
let TreeData: { name: string, montageName: string, hasChildren: boolean, path: string, id: string }[] | string = [];
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
let OWNER_ID = null;
var pickUpAction = document.querySelector("#pick_up_open_icon") as HTMLElement;
var open_table = document.querySelector("#open_table");
pickUpAction.onclick = pickUpOrOpen;
function pickUpOrOpen() {
    let classAtr = pickUpAction.getAttribute("class");
    if (classAtr == 'pick_up_icon') {
        pickUpAction.setAttribute("class", 'open_icon');
        open_table.setAttribute("style", 'display:table');
    } else {
        pickUpAction.setAttribute("class", 'pick_up_icon');
        open_table.setAttribute("style", 'display:none');
    }

}

var openScanCode = document.querySelector("#open_scan_code") as HTMLElement;
openScanCode.onclick = function () {
    let scanCode = document.querySelector("#scan_code");
    let scanCodeBox = document.querySelector(".transfer_scan_code_box");
    let scanCodeDisplay = window.getComputedStyle(scanCodeBox, null).display;
    if (scanCodeDisplay == 'none' || scanCodeDisplay == '') {
        QRCode.toCanvas(scanCode, file_id.to_base_58(), {
            errorCorrectionLevel: 'L',
            width: 84,
            height: 84,
            margin: 0
        });
        scanCodeBox.setAttribute('style', 'display:block;')
    } else {
        scanCode.innerHTML = ''
        scanCodeBox.setAttribute('style', 'display:none;')
    }

};
class FileInfo {
    m_sharedStatck: cyfs.SharedObjectStack;
    m_router: cyfs.NONRequestor;
    m_util_service: cyfs.UtilRequestor;
    m_trans: cyfs.TransRequestor;
    m_ndn_router: cyfs.NDNRequestor;
    constructor() {
        this.m_sharedStatck = cyfs.SharedObjectStack.open_runtime();
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
        let inner_path = null;
        console.log('file_id.obj_type_code()', file_id.obj_type_code())

        if ((file_id && file_id.obj_type_code() == 9)) {
            flags = cyfs.CYFS_REQUEST_FLAG_LIST_DIR;
            inner_path = window_inner_path ? window_inner_path : '/*';
        }
        const retObject = await ObjectUtil.getObject({ inner_path: inner_path, flags: flags, target: target_id, id: file_id, req_path: req_path, dec_id: dec_id, isReturnResult: true });
        let typeCode = retObject.object.object.desc().obj_type_code();
        console.log('retObject', retObject, retObject.object.object.body().unwrap(), retObject.object.object.desc());
        let object_info = retObject.object.object.desc();
        let author_info_dom = document.getElementById('author_info')
        if (object_info.author()) {
            author_info_dom.innerHTML = object_info.author()
        } else if (object_info.owner() && object_info.owner().is_some()) {
            author_info_dom.innerHTML = object_info.owner().unwrap();
        }
        if (retObject.object.object.desc().create_time().length) {
            document.getElementById('create_time_info').innerHTML = formatDate(cyfs.bucky_time_2_js_time(retObject.object.object.desc().create_time()), true);
        } else {
            document.getElementById('create_time_info').innerHTML = retObject.object.object.desc().create_time();
        }
        if (object_info.owner() && object_info.owner().is_some()) {
            document.getElementById('owner_info').innerHTML = '有主对象,Owner:' + object_info.owner().unwrap();
            OWNER_ID = object_info.owner().unwrap();
        } else {
            document.getElementById('owner_info').setAttribute('style', 'display:none');
        }
        if (object_info.calculate_id()) {
            document.getElementById('object_id').innerHTML = file_id.toString();
        }
        if (typeCode == 8) {
            // 展示图片
            showPicture(object_info);
        } else if (typeCode == 9) {
            document.getElementById('header_titile_name').innerHTML = '文件夹(DirObject)';
            console.log('object_info.content().obj_list().info.obj_list', object_info.content().obj_list().info.obj_list)
            TreeData = await file_info.getNodeTree(true, '', object_info, retObject.object.object)
            console.log('---TreeData', TreeData)
            let divHtml = `<div class="file_object_dir_box">
                                    <ul>
                                        <li class="file_active_li">
                                            <p class="file_li_p root">
                                                <i class="file_dir_box_i"></i><b class="file_dir_box_b"></b><span>${file_id.to_base_58()}</span> 
                                            </p>
                                    <ul id="root_dir"></ul></li></ul></div>`;

            document.getElementById('object_info_div').innerHTML = divHtml;
            await processDatas(true);
        } else if (typeCode == 16) {
            showMsg(retObject);
        }
        file_info.getDeviceInfo();
    }

    async getNodeTree(isRoot: boolean, name: string, object_info?: cyfs.AnyNamedObject | any, object_data?: cyfs.Dir) {
        let result = null;
        let mapDatas = null;
        if (isRoot) {
            result = object_info;
            if (!object_info.content().obj_list().info.obj_list) {
                let chunk_object_id = (cyfs.ObjectId.from_base_58(result.content().obj_list().info.chunk_id.to_base_58())).unwrap()
                console.log('chunk_object_id:', chunk_object_id)
                let get_body_data_result = object_data.get_data_from_body(chunk_object_id);
                console.log('get_body_data_result:', get_body_data_result)
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
        let node: { name: string, montageName: string, hasChildren: boolean, path: string, id: string }[] = []
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
        if (isRoot) {
            return node
        } else {
            const tree: string = await processDatas(false, node)
            console.log('---tree:', tree)
            return tree
        }
    }
    async downloadFile(id, name, path, isGetUrl) {
        console.log('------------device_id', device_id)
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

async function processDatas(isAll: boolean, node?: { name: string, montageName: string, hasChildren: boolean, path: string, id: string }[]) {
    console.log('----------TreeData', TreeData)
    const dirTmp: string = `<p class="file_li_p" data-type="dir" data-key="$$id" data-name="$$name"><i class="file_dir_box_i"></i><b class="file_dir_box_b"></b><span class="position_span"><span class="dir_name">$$$</span></span></p>`
    const fileTmp = `<p class="file_li_p"><i></i><b class="file_dir_unopen_box_b"></b><span class="position_span"><span class="relative_span"><a class="href_entrance" href="javascript:" data-path="$$path" data-id="$$id" data-key="$$$">$$$</a><strong class="dir_download" data-id="$$id" data-name="$$$" data-path="$$path"></strong></span></span></p>`
    const loop = function (arr) {
        var html = ''
        for (var i = 0; i < arr.length; i++) {
            // const domString = arr[i].hasChildren ? dirTmp.replaceAll("$$$", arr[i].name).replaceAll("$$id", arr[i].id).replaceAll("$$name", arr[i].montageName) : fileTmp.replaceAll("$$id", arr[i].id).replaceAll("$$$", arr[i].name).replaceAll("$$path", arr[i].path)
            const domString = arr[i].hasChildren ? dirTmp.replace(new RegExp(arr[i].name, 'ig'), "$$$").replace(new RegExp(arr[i].id, 'ig'), "$$id").replace(new RegExp(arr[i].montageName, 'ig'), "$$name") : fileTmp.replace(new RegExp(arr[i].id, 'ig'), "$$id").replace(new RegExp(arr[i].name, 'ig'), "$$$").replace(new RegExp(arr[i].path, 'ig'), "$$path")
            html += `<li class="file_li">${domString}</li>`
        }
        return html
    }
    let treeHtml = '';
    if (isAll) {
        treeHtml = loop(TreeData)
        $('#root_dir').html(treeHtml)
    } else {
        treeHtml = loop(node)
        return treeHtml
    }
}

async function showPicture(object_info) {
    if (file_name && !/\.(jpg|jpeg|png|GIF|JPG|PNG)$/.test(file_name)) {
        let treeHtml = `<div id="root_file">
                                <a class="href_entrance_file" href="javascript:">${file_name}<strong class="dir_download" data-id="${download_id}" data-name="${file_name}" data-path="${encodeURI(window_inner_path)}"></strong>
                                </a>
                            </div>`
        $('#object_info_div').html(treeHtml)
    } else {
        let imageURL = null;
        if (file_name) {
            imageURL = await file_info.downloadFile(object_info.calculate_id().to_base_58(), file_name, '*/', true);
        } else {
            imageURL = `cyfs://o/${object_info.calculate_id().to_base_58()}`;
        }
        const image = document.createElement('img');
        image.src = imageURL;
        let imageContainer = document.getElementById('object_info_div')
        imageContainer.appendChild(image);
        document.getElementById('header_titile_name').innerHTML = '文件(FileObject)';
    }
}

async function showMsg(retObject) {
    if (retObject.object.object.desc().obj_type() == cyfs.CoreObjectType.Msg) {
        let msg_ret = (new cyfs.MsgDecoder()).raw_decode(new Uint8Array(retObject.object.object_raw));
        console.log('------------msg_ret', msg_ret)
        if (msg_ret.err) {
        } else {
            let [msg,] = msg_ret.unwrap();
            console.log('------------msg', msg)
            msg.desc().content().content.match({
                Text: (text) => {
                    document.getElementById('object_info_div').innerHTML = `<div style="text-align:left">${text}</div>`;
                    document.getElementById('header_titile_name').innerHTML = '文本(TextObject)';
                },
                Object: (obj_content) => {
                }
            });

        }
    }
}

async function openDir($this, name) {
    let tree: { name: string; montageName: string; hasChildren: boolean; path: string; id: string; }[] | string = await file_info.getNodeTree(false, name)
    console.log("-tree", tree)
    let ul = document.createElement('ul');
    ul.innerHTML = tree.toString();
    $this.parent("li").addClass("file_active_li").removeClass("file_li")
    $this.parent("li")[0].append(ul)
}

async function rootClick(e) {
    window.event ? window.event.cancelBubble = true : e.stopPropagation();
    let li = e.target.parentNode.parentNode;
    if (li.className.indexOf('file_active_li') > -1) {
        li.classList.remove("file_active_li");
        li.classList.add("file_li");
        document.getElementById('root_dir').innerHTML = '';
    } else {
        file_info.initDatas();
        li.classList.remove("file_li");
        li.classList.add("file_active_li");
    }
}

function closeDir($this, key, next) {
    console.log("$this.parent('li').next('ul')", $this.parent('li'))
    $this.parent('li')[0].lastChild.remove()
    $this.parent("li").removeClass("file_active_li").addClass("file_li")
}
class MetaClient {
    meta_client: cyfs.MetaClient;
    constructor() {
        // 空参数或'test'为测试链，传'dev'为正式链
        this.meta_client = cyfs.create_meta_client();
    }
    // 获取余额
    async getBalanceInfo() {
        let balance = castToLocalUnit((await this.meta_client.getBalance(0, file_id.toString())).result);
        document.getElementById('balance_dom').innerHTML = balance + 'ECC';
        document.getElementById('balance_dom2').innerHTML = castToLocalUnit((await this.meta_client.getFileRewardAmount(file_id.toString())).result) + 'ECC';
    }
    // 获取转账列表
    async getCollectTxList() {
        console.log('get_meta_client', this.meta_client)
        console.log('MetaMinerTarget', cyfs.MetaMinerTarget)
        let txLists = (await this.meta_client.getCollectTxList([file_id.toString()], 0, 10000, null, null, ["0", "1"])).result;
        console.log('获取转账列表:', txLists)
        let file_object_tbody = document.getElementById('file_object_tbody');
        file_object_tbody.innerHTML = '';
        if (txLists) {
            let txHtml = '';
            txLists.forEach(element => {
                txHtml += `<tr>
                                <td>${getSubStr(element.from)}</td>
                                <td>${getSubStr(element.hash)}</td>
                                <td class="color_999">${formatDate(Number(element.create_time), true)}</td>
                                <td class="color_999">${castToLocalUnit(Number(element.value))}ECC</td>
                            </tr>`
            });
            file_object_tbody.innerHTML = txHtml;
        }
    }
}
const meta_client = new MetaClient();
meta_client.getBalanceInfo()
meta_client.getCollectTxList()
setInterval(function () { meta_client.getBalanceInfo() }, 60000);
setInterval(function () { meta_client.getCollectTxList() }, 60000);

$('#object_info_div').on('click', ".href_entrance", function () {
    const hrefStr = $(this).attr("data-id");
    const path = $(this).attr("data-path");
    const name = $(this).attr("data-key");
    console.log('hrefStr', hrefStr, window.location.search)
    let localtion_path = ''

    let str = window.location.search.split("?")[1];
    if (str.indexOf('&') > -1) {
        localtion_path = 'id=' + file_id + '&inner_path=' + path + '&file_name=' + name + '&download_id=' + hrefStr;
        target_id ? localtion_path += '&target=' + target_id : '';
        req_path ? localtion_path += '&req_path=' + req_path : '';
        dec_id ? localtion_path += '&dec_id=' + dec_id : '';
    } else {
        localtion_path = 'id=' + hrefStr + '&file_name=' + name;
    }
    console.log('localtion_path', localtion_path)
    window.location.href = "show.html?" + localtion_path;
})



