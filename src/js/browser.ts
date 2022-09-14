import * as cyfs from '../cyfs_sdk/cyfs'
import $ from 'jquery'
import JSBI from 'jsbi';
let QRCode = require('qrcode')
import { toast } from './lib/toast.min'
import { ObjectUtil, getSubStr, hasPC, LANGUAGESTYPE, castToLocalUnit } from './lib/util'
import { AppUtil, AppDetailUtil } from './app/app_util'


if (window.location.search == '?success') {
    let isToIndex = localStorage.getItem('is-restart-browser-to-index');
    if(isToIndex){
        localStorage.removeItem('is-restart-browser-to-index');
        window.location.href = 'cyfs://static/browser.html';
    }else{
        $('.browser_guide_success_cover').css('display', 'block');
    }
}

$(function(){
    if(LANGUAGESTYPE == 'zh'){
        $('title').html('首页');
    }else{
        $('title').html('Home');
    }
});

let isBindInterval: NodeJS.Timeout | null = null;
let isBindingInterval: NodeJS.Timeout | null = null;
let isBind = false;
let IS_FIRST_BIND:boolean = false;
let IS_FIRST_IN:boolean = true;
let SKIP_COUNT:number = 0;
let ANONYMOUS_STATUS:boolean;
let BIND_STATUS:boolean;
let SHORTCUT_LIST: {url:string, name: string, icon: string, index: number, isBuildin: boolean}[];
let BUILDIN_SHORTCUT_LIST: {url:string, name: string, icon: string, index: number, isBuildin: boolean}[];
let SEARCH_HISTORY_LIST:{name: string, type: number}[] = [];
let g_appList: {url:string, name: string, icon: string, index: number, isBuildin: boolean}[];

async function handlerGuidingProcess () {
    let getShortcutSession = localStorage.getItem('browser-shortcuts-list');
    console.origin.log('getShortcutSession', getShortcutSession);
    // let decapp = { url:'https://www.cyfs.com/download_en.html', name: 'Cyfs Software', icon: './img/dec_app_index_i.svg', index: 0, isBuildin: true };
        let gitHub = { url:'https://github.com/buckyos/CYFS', name: 'github', icon: './img/git_hub_index_i.svg', index: 0, isBuildin: true };
        let appmanagement = { url:'cyfs://static/DecAppStore/app_store_list.html', name: 'Dec App Management', icon: './img/last-child-li.svg', index: 1, isBuildin: true };
    // let shortcutsList = BUILDIN_SHORTCUT_LIST = [decapp, gitHub, appmanagement];
    let shortcutsList = BUILDIN_SHORTCUT_LIST = [gitHub, appmanagement];

    if(getShortcutSession){
        shortcutsList = BUILDIN_SHORTCUT_LIST = shortcutsList.concat(JSON.parse(getShortcutSession));
    }
    await renderingShortcut(shortcutsList);
    util.getAppList();
}

async function renderingShortcut (list: {url:string, name: string, icon: string, index: number, isBuildin: boolean}[]) {
    let html = '';
    let shortcutList: {url:string, name: string, icon: string, index: number, isBuildin: boolean}[] = [];
    list.forEach((element, index)=>{
        let item = {url: element.url, name: element.name, icon: element.icon, index: index, isBuildin: element.isBuildin};
        if(!element.isBuildin){
            shortcutList.push(item);
        }
        html += `<li>
                    ${element.isBuildin?'':`
                        <i class="app_edit_btn"></i>
                        <div class="app_edit_box">
                            <p class="app_edit_p" data-edit="${index}">${LANGUAGESTYPE == 'zh'? '编辑':'Edit'}</p>
                            <p class="app_delete_p" data-edit="${index}">${LANGUAGESTYPE == 'zh'? '删除':'Delete'}</p>
                        </div>
                    `}
                    <div class="app-content manager_app click_href_to" id="manager_app" data-url="${element.url}" >
                        <img src='${element.icon}' alt=""  onerror="this.src='./img/app_default_i.svg';this.οnerrοr=null">
                    </div>
                    <p class="app-name click_href_to" data-url="${element.url}">${element.name}</p>
                </li>`;
    });
    SHORTCUT_LIST = BUILDIN_SHORTCUT_LIST.concat(shortcutList);
    if(SHORTCUT_LIST.length < 10){
        html += `<li class="last-child-li">
                    <div class="app-content manager_app" id="manager_app">
                        <img src='./img/add_shoutcut_i.svg' alt="">
                    </div>
                    <p class="app-name" set-lan="html:Browser.AddShortcut">${LANGUAGESTYPE == 'zh'? '添加快捷方式':'Add Shortcut'}</p>
                </li>`;
    }
    $('#signin_ul').html(html);
    localStorage.setItem('browser-shortcuts-list', JSON.stringify(shortcutList));
}

function lenghtstr(str:string){
    var realLength = 0, len = str.length, charCode = -1;
    for (var i = 0; i < len; i++) {
        charCode = str.charCodeAt(i);
        if (charCode >= 0 && charCode <= 128)
            realLength += 1;
        else
            realLength += 2;
    }
    return realLength;
}

function isUnbind() {
    $.ajax({
        url: 'http://127.0.0.1:38090/status',
        success:function(result){
            console.log('getStatus-result', result);
            ANONYMOUS_STATUS = result.anonymous;
            if (result.is_bind) {
                // 已绑定
                if (isBindInterval) {
                    clearInterval(isBindInterval);
                }
                if (isBindingInterval) {
                    clearInterval(isBindingInterval);
                }
                isBind = true;
                BIND_STATUS = true;
                if(IS_FIRST_BIND){
                    window.location.href = 'cyfs://static/browser.html?success';
                    IS_FIRST_BIND = false;
                }
                util.getDeviceInfo();
            }
            if (result.anonymous) {
                // 匿名模式
                $('#ood_status_icon').css('background', 'none');
                console.log('1111LANGUAGESTYPE', LANGUAGESTYPE)
                $('#people_name2').html(LANGUAGESTYPE == 'zh'? '匿名用户':'Anonymous People');
                $('#user_switch').css({'background':'url(./img/browser_anonymous_icon.svg) no-repeat center center','background-size': '100%'});
                $('.anonymous_box').css('display', 'block');
                $('.review_anonymous_box').css('display', 'block');
                $('#signin_ul').css('display', 'none');
                $('#unsignin_input').addClass('unsignin_input').attr('disabled', 'disabled');
                isBind = false;
                IS_FIRST_BIND = true;
            }else{
                if (result.is_bind) {
                    if(IS_FIRST_IN){
                        handlerGuidingProcess();
                        IS_FIRST_IN = false;
                    }
                    $('.anonymous_box').css('display', 'none');
                    $('.review_anonymous_box').css('display', 'none');
                }
            }
        }
    });
};

// 搜索
async function searchTxt(value?:string) {
    if (isBind) {
        let val = value ? value: String($('#unsignin_input')!.val()!).trim();
        if(val){
            let isObject = await util.txtToId(val);
            let getHistorySession = localStorage.getItem('browser-search-history-list');
            let historyList:{name: string, type: number}[] = [];
            console.origin.log('getHistorySession', getHistorySession);
            if(getHistorySession){
                historyList = SEARCH_HISTORY_LIST = JSON.parse(getHistorySession);
                historyList.forEach((history, index) => {
                    if(history.name == val){
                        SEARCH_HISTORY_LIST.splice(index, 1);
                    }
                });
            }
            SEARCH_HISTORY_LIST.unshift({ name: val, type:isObject ? 0 : 1 });
            if(SEARCH_HISTORY_LIST.length > 10){
                SEARCH_HISTORY_LIST.splice(SEARCH_HISTORY_LIST.length - 1, 1);
            }
            localStorage.setItem('browser-search-history-list', JSON.stringify(SEARCH_HISTORY_LIST));
            if(isObject){
                window.open("cyfs://static/object_browser/objects.html?id=" + val);
            }else{
                chrome.search.query({text: val, disposition: 'NEW_TAB'});
            }
        }else{
            window.open("cyfs://static/object_browser/objects.html");
        }
    }
}
class Util {
    m_sharedStatck: cyfs.SharedCyfsStack;
    m_util_service: cyfs.UtilRequestor;
    m_router: cyfs.NONRequestor;
    meta_client: cyfs.MetaClient;
    constructor() {
        this.m_sharedStatck = cyfs.SharedCyfsStack.open_runtime();
        this.m_util_service = this.m_sharedStatck.util();
        this.m_router = this.m_sharedStatck.non_service();
        // 空参数或'test'为测试链，传'dev'为正式链
        this.meta_client = cyfs.create_meta_client();
    }

    async getOodStatus(id?:cyfs.ObjectId) {
        // 连接状态信息
        let req = id ? { common: { flags: 0, target: id } } : { common: { flags: 0 } };
        let ood_status = await this.m_util_service.get_ood_status(req);
        if (!ood_status.err) {
            ood_status = ood_status.unwrap().status;
            console.log('ood_status:', ood_status);
            if (ood_status.last_ping_result == 0) {
                // 在线
                return true;
            } else {
                // 不在线
                return false;
            }
        }else{
            return false;
        }
        
    }

    async getDeviceInfo() {
        // Device静态信息
        let current_device_static_info = await this.m_util_service.get_device_static_info({ common: { flags: 0 } });
        if (!current_device_static_info.err) {
            current_device_static_info = current_device_static_info.unwrap().info;
        }
        console.info('current_device_static_info:', current_device_static_info);
        if (current_device_static_info.owner_id) {
            const peopleR = (await ObjectUtil.getObject({ id: current_device_static_info.owner_id, isReturnResult: true, flags: 1 })).object;
            console.origin.log('peopleR:', peopleR);
            let oodList = peopleR.object.body().unwrap().content().ood_list;
            if (oodList[0]) {
                let mainStatus: boolean = await this.getOodStatus();
                console.log('--mainStatus', mainStatus)
                if(oodList.length == 1){
                    if(mainStatus){
                        $('#ood_status_icon').css('background', 'url(./img/browser_main_ood_online.svg) no-repeat center center');
                    }else{
                        $('#ood_status_icon').css('background', 'url(./img/browser_main_ood_offline.svg) no-repeat center center');
                    }
                }else if(oodList.length == 2){
                    let minerStatus: boolean = await this.getOodStatus(oodList[1].object_id);
                    console.log('--minerStatus', mainStatus)
                    if(mainStatus && minerStatus){
                        $('#ood_status_icon').css('background', 'url(./img/browser_ood_online_online.svg) no-repeat center center');
                    }else if(mainStatus && !minerStatus){
                        $('#ood_status_icon').css('background', 'url(./img/browser_ood_online_offline.svg) no-repeat center center');
                    }else if(!mainStatus && minerStatus){
                        $('#ood_status_icon').css('background', 'url(./img/browser_ood_offline_online.svg) no-repeat center center');
                    }else if(!mainStatus && !minerStatus){
                        $('#ood_status_icon').css('background', 'url(./img/browser_ood_offline_offline.svg) no-repeat center center');
                    }
                }
            }
            $('#people_name2').html(peopleR.object.name() ? peopleR.object.name() : (LANGUAGESTYPE == 'zh'? '未设置名称':'name not set'));
            if(peopleR.object.icon()){
                $('#user_switch').css({'background':'url(cyfs://o/'+peopleR.object.icon().object_id +') no-repeat center center','background-size': '100% 100%'});
            }else{
                $('#user_switch').css({'background':'url(./img/browser_people_icon.svg) no-repeat center center','background-size': '100%'});
            }
        }
    }

    async txtToId (id: string) {
        let idResult = cyfs.ObjectId.from_base_58(id);
        if (idResult.err) {
            return false;
        } else {
            return true;
        }
    }

    async getAppList() {
        const list_ret = await AppUtil.getAllAppListFun();
        console.origin.log('app installed list result:', list_ret);
        if (list_ret.err || !list_ret.app_list().size) {
        } else {
            for (const appid of list_ret.app_list().array()) {
                console.log('appid.object_id:', appid.object_id)
                let app = await AppUtil.handleAppDetail(appid.object_id);
                console.origin.log('------------showApp-app', app);
                let app_status = app.status;
                if((app_status == cyfs.AppLocalStatusCode.NoService || app_status == cyfs.AppLocalStatusCode.Running) && app.webdir){
                    console.log('get_app_status.webdir().to_base_58()', app.app_name, app.webdir.to_base_58())
                    BUILDIN_SHORTCUT_LIST.push({ url:`cyfs://o/${app.webdir.to_base_58()}/index.html`, name: app.app_name, icon: app.app_icon, index: BUILDIN_SHORTCUT_LIST.length - 1, isBuildin: true })
                }
            }
        }
    }
}
const util = new Util();
$(function(){
    isUnbind();
});

// 添加快捷方式
$('#signin_ul').on('click', ' .last-child-li', () => {
    $('.add_url_input_name').val('');
    $('.add_url_input_url').val('');
    $('.add_url_btn_save').attr('data-isAdd', 'true');
    $('.add_url_cover_box').css('display', 'block');
})

function showThisScan(name:string) {
    $(name).html('');
    $.ajax({
        url: 'http://127.0.0.1:1321/check',
        success:function(data){
            let result = JSON.parse(data);
            console.log('check-result', result)
            let localIps = result.access_info.addrs;
            let access_token = result.access_info.access_token?result.access_info.access_token:'';
            let content = {
                "flag": "cyfs",
                "type": "bindDevice",
                "data": {
                    "type": 2,
                    "ip": localIps,
                    "access_token": access_token
                }
            }
            QRCode.toCanvas(document.getElementById('scan_box'), JSON.stringify(content), {
                errorCorrectionLevel: 'L',
                width: 120,
                height: 120,
                margin: 0
            });
            if(!BIND_STATUS){
                if(typeof(isBindInterval) == 'number' || !isBindInterval){
                    isBindInterval = setInterval(() => {
                        isUnbind();
                    }, 2000);
                }
            }
        }
    })
}

$('#user_switch').on('click', function () {
    if(isBind){
        window.location.href = 'cyfs://static/info.html';
    }else{
        if($('#scan_content').css('display') == 'block'){
            if(isBindInterval){
                clearInterval(isBindInterval);
            }
            $('#scan_content').css('display', 'none');
        }else{
            $('#scan_content').css('display', 'block');
            showThisScan('#scan_box');
        }
    }
})

$('.browser-search-svg').on('click', (event) => {
    searchTxt()
})

$('#unsignin_input').on('keydown', (event) => {
    if (event.keyCode == 13) { searchTxt() }
})
//搜索框获取焦点
$('#unsignin_input').on('focus', function(){
    let getHistorySession = localStorage.getItem('browser-search-history-list');
    console.origin.log('getHistorySession', getHistorySession);
    if(getHistorySession){
        SEARCH_HISTORY_LIST = JSON.parse(getHistorySession);
        let html = '';
        SEARCH_HISTORY_LIST.forEach((history:{name: string, type: number}, index:number) => {
            if(index <= 10){
                html += `<p class="search_history_p">
                        <i class="search_history_time_i"></i>
                        <a class="search_history_a" href="javascript:" data-name="${history.name}">${history.name}</a>
                        <i class="search_history_close" data-name="${history.name}"></i>
                    </p>`;
            }
        });
        $('.search_history_list_box').html(html);
        $('.search_history_list_box').css('display', 'block');
    }
    $('.search-input').css({'border-radius': '16px', 'box-shadow': '0px 3px 6px 1px rgba(0, 0, 0, 0.16)'});
})

$(document).bind("click", function(e) {
    var target = $(e.target);
    e.stopPropagation();
    if (target.closest("#unsignin_input").length == 0 && target.closest(".search_history_list_box").length == 0 && target.closest(".search_history_close").length == 0) { 
        $('.search_history_list_box').css('display', 'none');
        $('.search-input').css({'border-radius': '22px', 'box-shadow': '0px 4px 8px 1px rgba(0, 0, 0, 0.08)'});
    }
})

function handleGuideBox (last?:string|null, next?: string|null) {
    $('.browser_cover_box_guide').css('display', 'block');
    $('.browser_guide_box, #scan_content').css('display', 'none');
    if(next){
        $('.'+next).css('display', 'block');
        if(next == 'browser_guide_box_three'){
            showThisScan('#scan_box_canvas');
        }
    } else {
        $('.' + last).css('display', 'block');
    }
    if(isBindInterval){
        clearInterval(isBindInterval);
    }
    if(isBindingInterval){
        clearInterval(isBindingInterval);
    }
    if(next == 'browser_guide_box_three' || last == 'browser_guide_box_three'){
        $('.browser_cover_box_loading').css('display', 'none');
    }
}

$('.browser_guide_last_next').on('click', async function () {
    let next = $(this).attr('data-next');
    let last = $(this).attr('data-last');
    handleGuideBox(last, next);
})

$('.browser_guide_cancel_btn').on('click', (event) => {
    $('.browser_cover_box_confirm').css('display', 'block');
})

$('.browser_cover_close_btn').on('click', (event) => {
    $('.browser_cover_box_confirm').css('display', 'none');
})

$('.browser_activate_success_btn').on('click', async function () {
    console.origin.log('isBindInterval', isBindInterval)
    console.origin.log('isBindingInterval', isBindingInterval)
    if(isBindInterval){
        clearInterval(isBindInterval);
    }
    if(isBindingInterval){
        clearInterval(isBindingInterval);
    }
    $('.browser_cover_box_confirm, .browser_cover_box_guide, .browser_cover_box_activate, .browser_cover_box_loading').css('display', 'none');
})

$('#signin_ul').on('click', ".click_href_to",async function () {
    let url = $(this).attr('data-url');
    window.open(url);
})

$('.browser_cover_yes_btn, .browser_activate_close').on('click', async function () {
    if(isBindInterval){
        clearInterval(isBindInterval);
    }
    if(isBindingInterval){
        clearInterval(isBindingInterval);
    }
    $('.browser_cover_box_confirm, .browser_cover_box_guide, .browser_cover_box_activate').css('display', 'none');
    if(SKIP_COUNT == 0){
        $.ajax({
            url: 'http://127.0.0.1:38090/status',
            success:function(result){
                if(result.is_bind){
                    $('#activate_success_content').css('display','block');
                }else{
                    $('#scan_content').css('display','block');
                    showThisScan('#scan_box');
                }
            }
        });
        
    }
    SKIP_COUNT++;
})

$('.anonymous_subtitle').on('click', async function () {
    if(isBindInterval){
        clearInterval(isBindInterval);
    }
    window.open('cyfs://static/guide.html');
})

$('.browser_activate_false_btn, .browser_activate_false_close').on('click', async function () {
    if(isBindInterval){
        clearInterval(isBindInterval);
    }
    if(isBindingInterval){
        clearInterval(isBindingInterval);
    }
    $('.browser_cover_box_activate_false').css('display', 'none');
    $('.browser_cover_box_loading').css('display', 'none');
})

$('.browser_guide_box_introduce_p').on('click', ".skip_to_scan", function () {
    handleGuideBox(null, 'browser_guide_box_three');
})

$('.cyfs-icon').on('click', function () {
    window.location.href = 'https://www.cyfs.com/';
})

$('.add_url_box_close_i, .add_url_btn_cancel').on('click', function () {
    $('.add_url_cover_box').css('display', 'none');
})

$('.add_url_btn_save').on('click', async function () {
    let name = String($('.add_url_input_name').val()).trim();
    let url = String($('.add_url_input_url').val()).trim();
    if(!name){
        toast({
            message: LANGUAGESTYPE == 'zh'?"请输入名称": 'Please enter a name.',
            time: 1500,
            type: 'warn'
        });
        return;
    }
    console.log('lenghtstr(name)', name, lenghtstr(name))
    if(lenghtstr(name) > 100){
        toast({
            message: LANGUAGESTYPE == 'zh'?"名称不能超过一百个字符": 'Name cannot exceed 100 characters.',
            time: 1500,
            type: 'warn'
        });
        return;
    }
    if(!url){
        toast({
            message: LANGUAGESTYPE == 'zh'?"请输入url": 'Please enter a URL.',
            time: 1500,
            type: 'warn'
        });
        return;
    }
    var Expression = /http(s)?:\/\/([\w-]+\.)+[\w-]+(\/[\w- .\/?%&=]*)?/;
    var objExp = new RegExp(Expression);
    if(url.indexOf("cyfs://") != 0 && !objExp.test(url)){
        toast({
            message: LANGUAGESTYPE == 'zh'?"请输入正确的url": 'please enter correct URL.',
            time: 1500,
            type: 'warn'
        });
        return;
    }
    let isAdd = $('.add_url_btn_save').attr('data-isAdd');
    let isRepeat = false;
    SHORTCUT_LIST.forEach((shortcut)=>{
        if(isAdd == 'true'){
            if(shortcut.url == url){
                isRepeat = true;
            }
        }else{
            let index = $('.add_url_btn_save').attr('data-index');
            if(shortcut.url == url && Number(index) != shortcut.index){
                isRepeat = true;
            }
        }
    });
    if(isRepeat){
        toast({
            message: LANGUAGESTYPE == 'zh'?"快捷方式已存在。": 'Shortcut already exists.',
            time: 1500,
            type: 'warn'
        });
        return;
    }
    $('.add_url_cover_box').css('display', 'none');
    let icon = '';
    if(url.indexOf("cyfs://") == 0){
        var elA = document.createElement('a');
        elA.href = url;
        if(elA.host == 'r' || elA.host == 'a' || elA.host == 'o'){
            icon = await getIcon(elA.origin, elA.pathname);
        }else{
            icon = elA.origin + '/favicon.ico';
        }
        console.log('elA.origin', elA.origin, elA.hostname, elA.pathname, icon);
    }
    if(isAdd == 'true'){
        SHORTCUT_LIST.push({url:url, name: name, icon: icon, index: SHORTCUT_LIST.length, isBuildin: false});
    }else{
        let index = $('.add_url_btn_save').attr('data-index');
        SHORTCUT_LIST.splice(Number(index), 1, {url:url, name: name, icon: icon || SHORTCUT_LIST[Number(index)].icon, index: SHORTCUT_LIST[Number(index)].index, isBuildin: false})
    }
    renderingShortcut(SHORTCUT_LIST);
})

async function getIcon(origin:string, pathname:string) {
    let pathArr = pathname.split('/');
    pathArr.splice(pathArr.length - 1, 1);
    let urlArr:string[] = [];
    let urlAdd:string = '';
    pathArr.forEach((path)=>{
        urlAdd += path + '/';
        urlArr.unshift(origin+urlAdd);
    })
    console.origin.log('urlArr', urlArr);
    let isGetIcon = false;
    let getIcon:string = '';
    for (let index = 0; index < urlArr.length; index++) {
        const url = urlArr[index];
        if(!isGetIcon){
            $.ajax({
                url: url + 'favicon.ico',
                async:false,
                success:function(result){
                    console.log('url-result', url + 'favicon.ico');
                    isGetIcon = true;
                    getIcon = url + 'favicon.ico';
                }
            })
        }
    }
    return getIcon;
}

$('.input-div').on('click', (event) => {
    if(ANONYMOUS_STATUS){
        toast({
            message: LANGUAGESTYPE == 'zh'?"当前为匿名模式，不可使用该功能！": 'Current mode is for read-only, and this function is unavailable!',
            time: 1500,
            type: 'warn'
        });
    }
})

$('#signin_ul').on('click', '.app_edit_btn', async function () {
    let isShow = $(this).siblings('.app_edit_box').css('display');
    if(isShow == 'block'){
        $(this).siblings('.app_edit_box').css('display', 'none');
    }else{
        $(this).siblings('.app_edit_box').css('display', 'block');
    }
})

//编辑快捷方式
$('#signin_ul').on('click', '.app_edit_p', async function () {
    $(this).parent('.app_edit_box').css('display', 'none');
    let index = $(this).attr('data-edit');
    if(Number(index) >= 0 ){
        $('.add_url_input_name').val(SHORTCUT_LIST[Number(index)].name);
        $('.add_url_input_url').val(SHORTCUT_LIST[Number(index)].url);
        $('.add_url_btn_save').attr('data-isAdd', 'false');
        $('.add_url_btn_save').attr('data-index', index!);
        $('.add_url_cover_box').css('display', 'block');
    }
})
//删除快捷方式
$('#signin_ul').on('click', '.app_delete_p', async function () {
    let index = $(this).attr('data-edit');
    $(this).parent('.app_edit_box').css('display', 'none');
    SHORTCUT_LIST.splice(Number(index), 1);
    renderingShortcut(SHORTCUT_LIST);
})

//删除历史搜索记录
$('.search_history_list_box').on('click', '.search_history_close', async function () {
    let name = $(this).attr('data-name');
    $(this).parent('.search_history_p').remove();
    SEARCH_HISTORY_LIST.forEach((history:{name: string, type: number}, index:number) => {
        if(name == history.name){
            SEARCH_HISTORY_LIST.splice(index, 1);
        }
    });
    localStorage.setItem('browser-search-history-list', JSON.stringify(SEARCH_HISTORY_LIST));
})

$('.search_history_list_box').on('click', '.search_history_a', async function () {
    let name = $(this).attr('data-name');
    searchTxt(name);
})

$('.guide_acivate_success_cancel_btn').on('click', function () {
    window.location.href = 'cyfs://static/browser.html';
})

$('.guide_acivate_success_confirm_btn').on('click', function () {
    localStorage.setItem('is-restart-browser-to-index', 'true');
    chrome.runtime.restart();
})