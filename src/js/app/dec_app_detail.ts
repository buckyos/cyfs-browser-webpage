import $ from 'jquery';
import * as cyfs from '../../cyfs_sdk/cyfs'
import { toast } from '../lib/toast.min'
let QRCode = require('qrcode')
import { ObjectUtil, formatDate, LANGUAGESTYPE, copyData, castToLocalUnit } from '../lib/util'
import { isBind, AppUtil, AppDetailUtil } from './app_util'

let g_appId:string = '';
let g_version:string = '';
let g_isBind:boolean;
let g_appOwner:cyfs.ObjectId;
let g_versionInstalled:string;
let g_statusInstalled:number;
let g_isInstalled:boolean = false;
let g_overviewStr:string = '';
let g_owner: cyfs.ObjectId;
let g_app: { app_id: cyfs.ObjectId | string, app_name: string, app_icon: string, fidArray: { fid: cyfs.ObjectId, version: string, summary: string }[], owner: cyfs.ObjectId | undefined, app: cyfs.DecApp };
let g_versionTimeList:string[];
let g_releasedate:{[key: string]: string}
let g_isStart:boolean;

if (window.location.search.split("?")[1]) {
    let str = window.location.search.split("?")[1];
    let arr = str.split('&');
    if (arr) {
        for (let i = 0; i < arr.length; i++) {
            if (arr[i].indexOf('=') > -1 && arr[i].split('=')[1] && arr[i].split('=')[0] == 'id') {
                g_appId = arr[i].split('=')[1];
            }
            if (arr[i].indexOf('=') > -1 && arr[i].split('=')[1] && arr[i].split('=')[0] == 'version') {
                g_version = arr[i].split('=')[1];
            }
            if (arr[i].indexOf('=') > -1 && arr[i].split('=')[1] && arr[i].split('=')[0] == 'type') {
                g_isInstalled = true;
            }
        }
    }
}
console.log('---------g_appId, g_version, g_isInstalled:', g_appId, g_version, g_isInstalled);
$(async function(){
    isBind();
    if(LANGUAGESTYPE == 'zh'){
      $('title').html(g_isInstalled ? '已安装应用详情':'应用详情');
    }else{
      $('title').html(g_isInstalled ? 'Installed DEC App Detail':'DEC App Detail');
    }
    g_isBind = await isBind();
    if(!g_isBind){
      window.location.href = 'cyfs://static/browser.html';
    }
});

class AppManager {
    m_sharedStatck: cyfs.SharedCyfsStack;
    m_util_service: cyfs.UtilRequestor;
    m_router: cyfs.NONRequestor;
    constructor() {
      this.m_sharedStatck = cyfs.SharedCyfsStack.open_runtime();
      this.m_router = this.m_sharedStatck.non_service();
      this.m_util_service = this.m_sharedStatck.util();
    }

    async getOwner () {
        let result = await this.m_util_service.get_device({ common: { flags: 0 } });
        if (!result.err) {
          result = result.unwrap();
        }
        let current_device = result.device
        g_owner = current_device.desc().owner().unwrap();
    }

    async initData(id:string) {
        appManager.getOwner();
        let app = g_app = await AppUtil.showApp(id, false);
        console.origin.log('---------app-data:', app);
        $('.app_detail_icon').attr('src', app.app_icon || '../img/app/app_default_icon.svg');
        let owner = null;
        let peopleName = 'cyfs';
        if (app.app.desc().owner) {
            owner = g_appOwner = app.app.desc().owner().unwrap();
            const peopleR = (await ObjectUtil.getObject({ id: owner!, isReturnResult: true, flags: 1 })).object;
            console.origin.log('peopleR:', peopleR);
            peopleName = peopleR.object.name() || 'cyfs';
        }
        $('.app_detail_dec_id_p').html(`<span class="app_detail_dec_id">Dec-ID：${g_appId}</span><i class="upload_app_info_id_copy" data-id="${g_appId}"></i>`)
        $('.app_detail_developer_p').html(`<span class="app_detail_developer">${LANGUAGESTYPE == 'zh'?'开发者：': 'Developer：'}${peopleName}  (<i class="app_detail_developer_color">${owner}</i>)</span><i class="upload_app_info_id_copy" data-id="${owner}"></i>`)
        // if(app.app.desc().dec_id().is_some()){
        //     let decid = app.app.desc().dec_id().unwrap();
        //     $('.app_detail_dec_id_p').html(`<span class="app_detail_dec_id">Dec-ID：${decid}</span><i class="upload_app_info_id_copy" data-id="${decid}"></i>`)
        // }
        let appBody = app.app.body().unwrap();
        let introduce:string = '';
        if (appBody.content().desc.is_some()) {
            g_overviewStr = appBody.content().desc.unwrap().toString();
            introduce = g_overviewStr;
        }else{
            introduce = LANGUAGESTYPE == 'zh'?'暂未介绍': 'No introduction yet';
        }
        $('.app_detail_overview').html(`<span  class="app_detail_overview_extra">${LANGUAGESTYPE == 'zh'?'简介': 'Overview'}：${introduce}</span><span class="app_detail_overview_more"></span>`);
        let moreWidth = $('.app_detail_overview_extra').css('width');
        if(moreWidth=='477px'){
            $('.app_detail_overview_more').html('more');
        }
        if(g_isInstalled){
            // app installed detail
            $('.app_detail_info_container, .app_subtitle_installed_box, .installed_status_checkbox').css('display', 'block');
            appManager.renderAppInfo(id);
            setTimeout(() => {
                appManager.initData(g_appId);
            }, 10000);
        }else{
            // app detail
            $('.app_detail_title').html(`${app.app_name}<i class="app_detail_version_share"></i>`);
            $('.app_detail_software_box, .app_detail_version_box, .app_subtitle_detail_box, .to_tip_list').css('display', 'block');
        }
        let appExtId = await cyfs.AppExtInfo.getExtId(app.app);
        console.log('appExtId:', appExtId);
        let appExt = await ObjectUtil.getObject({id:appExtId, decoder:new cyfs.AppExtInfoDecoder, flags: 1});
        console.log('appExt:', appExt);
        if (appExt.err) {
        } else {
        if (appExt[0]) {
            let info = JSON.parse(appExt[0].info());
            console.origin.log('appExt-info', info);
            if (info && info['cyfs-app-store']){
                if(info['cyfs-app-store'].releasedate){
                    g_releasedate = info['cyfs-app-store'].releasedate;
                }
                if(info['cyfs-app-store'].tag){
                    let tags = info['cyfs-app-store'].tag;
                    let html = '';
                    tags.forEach(tag => {
                        html += `<span>#${tag}</span>`;
                    });
                    $('.app_detail_tag_box').html(html);
                }
                if(info['cyfs-app-store'].client){
                    let clients = info['cyfs-app-store'].client;
                    if(clients.android){
                        $('.app_software_android, .app_detail_client_box').css('display', 'block').attr('data-url', clients.android);
                    }
                    if(clients.iOS){
                        $('.app_software_ios, .app_detail_client_box').css('display', 'block').attr('data-url', clients.iOS);
                    }
                    if(clients.windows){
                        $('.app_software_windows, .app_detail_client_box').css('display', 'block').attr('data-url', clients.windows);
                    }
                    if(clients.macOS){
                        $('.app_software_macos, .app_detail_client_box').css('display', 'block').attr('data-url', clients.macOS);
                    }
                    if(clients.linux){
                        $('.app_software_linux, .app_detail_client_box').css('display', 'block').attr('data-url', clients.linux);
                    }
                    if(clients.other){
                        $('.app_software_other, .app_detail_client_box').css('display', 'block').attr('data-url', clients.other);
                    }
                }
                if(info['cyfs-app-store'].community){
                    let community = info['cyfs-app-store'].community;
                    community.forEach(element => {
                        if(element['CyberChat'] && element['CyberChat'][0]){
                            $('.app_detail_share_box').css('display', 'block');
                            $('.app_detail_share_cyfs').css('display', 'block').attr('data-url', element['CyberChat'][0]);
                        }
                        if(element['Discord'] && element['Discord'][0]){
                            $('.app_detail_share_box').css('display', 'block');
                            $('.app_detail_share_discard').css('display', 'block').attr('data-url', element['Discord'][0]);
                        }
                        if(element['Twitter'] && element['Twitter'][0]){
                            $('.app_detail_share_box').css('display', 'block');
                            $('.app_detail_share_twitter').css('display', 'block').attr('data-url', element['Twitter'][0]);
                        }
                        if(element['GitHub'] && element['GitHub'][0]){
                            $('.app_detail_share_box').css('display', 'block');
                            $('.app_detail_share_github').css('display', 'block').attr('data-url', element['GitHub'][0]);
                        }
                    });
                }
            }
        }
        }
        if(!g_isInstalled){
            appManager.renderVersionList();
        }
    }

    async renderAppInfo (id) {
        let app = await AppUtil.handleAppDetail(id);
        console.origin.log('---------------app-info', app);
        if(app.status != cyfs.AppLocalStatusCode.NoService && app.status != cyfs.AppLocalStatusCode.InstallFailed && app.status != cyfs.AppLocalStatusCode.UninstallFailed){
            if(app.status == cyfs.AppLocalStatusCode.Running || app.status == cyfs.AppLocalStatusCode.StopFailed){
                $('.operate_btn').css('display', 'block');
                $('.app_status_loading').css('display', 'none');
                g_isStart = false;
                $('.operate_btn').html('stop');
            }else if(app.status == cyfs.AppLocalStatusCode.Installing || app.status == cyfs.AppLocalStatusCode.Stopping || app.status == cyfs.AppLocalStatusCode. Uninstalling){
                $('.operate_btn').css('display', 'none');
                $('.app_status_loading').css('display', 'block');
            }else{
                $('.operate_btn').css('display', 'block');
                $('.app_status_loading').css('display', 'none');
                g_isStart = true;
                $('.operate_btn').html('start');
            }
        }
        let app_status = app.status;
        let appStr = "";
        if (app_status == cyfs.AppLocalStatusCode.Init) {
          appStr = LANGUAGESTYPE == 'zh'? '初始化' : 'Init';
        }else if(app_status == cyfs.AppLocalStatusCode.Installing){
            appStr = LANGUAGESTYPE == 'zh'? '安装中' : 'Installing';
        }else if(app_status == cyfs.AppLocalStatusCode.InstallFailed){
            appStr = LANGUAGESTYPE == 'zh'? '安装失败' : 'InstallFailed';
        }else if(app_status == cyfs.AppLocalStatusCode.NoService){
            appStr = LANGUAGESTYPE == 'zh'? '无DEC服务' : 'NoService';
        }else if(app_status == cyfs.AppLocalStatusCode.Stopping){
            appStr = LANGUAGESTYPE == 'zh'? '停止中' : 'Stopping';
        }else if(app_status == cyfs.AppLocalStatusCode.Stop){
            appStr = LANGUAGESTYPE == 'zh'? '已停止' : 'Stop';
        }else if(app_status == cyfs.AppLocalStatusCode.StopFailed){
            appStr = LANGUAGESTYPE == 'zh'? '停止失败' : 'StopFailed';
        }else if(app_status == cyfs.AppLocalStatusCode.Starting){
            appStr = LANGUAGESTYPE == 'zh'? '启动中' : 'Starting';
        }else if(app_status == cyfs.AppLocalStatusCode.Running){
            appStr = LANGUAGESTYPE == 'zh'? '运行中' : 'Running';
        }else if(app_status == cyfs.AppLocalStatusCode.StartFailed){
        appStr = LANGUAGESTYPE == 'zh'? '启动失败' : 'StartFailed';
        }else if(app_status == cyfs.AppLocalStatusCode.Uninstalling){
            appStr = LANGUAGESTYPE == 'zh'? '卸载中' : 'Uninstalling';
        }else if(app_status == cyfs.AppLocalStatusCode.UninstallFailed){
            appStr = LANGUAGESTYPE == 'zh'? '卸载失败' : 'UninstallFailed';
        }else if(app_status == cyfs.AppLocalStatusCode.Uninstalled){
            appStr = LANGUAGESTYPE == 'zh'? '卸载成功' : 'Uninstalled';
        }else if(app_status == cyfs.AppLocalStatusCode.RunException){
            appStr = LANGUAGESTYPE == 'zh'? '运行异常' : 'RunException';
        }
        $('.app_detail_p').html(appStr);
        if(!app.auto_update && app.version != app.fidArray[app.fidArray.length - 1].version){
            $('.update_installed_btn').css('display', 'block');
        }
        $('.app_detail_title').html(`${app.app_name}<span class="app_detail_subtitle">${app.version}</span><i class="app_detail_version_share"></i>`);
        $('.app_installed_version').html(app.version);
        let summary:string = '';
        app.fidArray.forEach(element => {
            if(element.version == app.version){
                summary = element.summary;
            }
        });
        $('.app_installed_summary').html(summary);
        $('.app_installed_time').html(app.version);
    }

    async renderVersionList(){
        let app = g_app;
        let appStatus = await AppUtil.getAppStatus(g_appId);
        console.origin.log('getAppStatus-ret-err', appStatus);
        if(!appStatus.err){
            g_versionInstalled = appStatus.version();
            g_statusInstalled = appStatus.status();
        }
        let appVersionsHtml = '';
        if (app.fidArray.length > 0) {
            app.fidArray.forEach(element => {
                appVersionsHtml =  `<tr>
                                        <td>
                                            <a class="app_detail_version">${element.version}</a>
                                        </td>
                                        <td>${element.summary}</td>
                                        <td>${g_releasedate&&g_releasedate[element.version]?g_releasedate[element.version]:''}</td>
                                        <td>
                                            ${(g_versionInstalled != element.version || g_statusInstalled == cyfs.AppLocalStatusCode.Init || g_statusInstalled == cyfs.AppLocalStatusCode.InstallFailed || g_statusInstalled == cyfs.AppLocalStatusCode.Uninstalled)?`<button class="app_primary_btn app_detail_version_install" data-version="${element.version}">${LANGUAGESTYPE == 'zh'?'安装': 'install'}</button>`:`<button class="app_disable_btn app_detail_version_installed">${LANGUAGESTYPE == 'zh'?'已安装': 'installed'}</button>`}
                                        </td>
                                    </tr>` + appVersionsHtml;
            });
            $('.app_detail_version_tbody').html(appVersionsHtml);
        };
    }
}

const appManager = new AppManager();
appManager.initData(g_appId);

$('.app_detail_box').on('click', '.upload_app_info_id_copy', function () {
    let id = $(this).attr('data-id') || '';
    console.log('id', id)
    copyData(id);
})

$('.app_detail_title').on('click', '.app_detail_version_share', function () {
    let href = 'cyfs://static/DecAppStore/app_detail.html?id=' + g_appId;
    $('#copy_textarea').text(href).show();
    $('#copy_textarea').select();
    document.execCommand('copy', false, '');
    $('#copy_textarea').hide();
    toast({
        message: LANGUAGESTYPE == 'zh'?"App链接复制成功":'App link copied',
        time: 1500,
        type: 'success'
    });
})

$('.app_cover_box').on('click', '.close_cover_i', function () {
    $('.app_cover_box').css('display', 'none');
})

$('.app_detail_overview').on('click', '.app_detail_overview_more', function () {
    $('.app_overview_box').html(g_overviewStr);
    $('.app_cover_overview_container').css('display', 'block');
})

$('.app_tip_btn').on('click', function () {
    $('.app_cover_tip_box').css('display', 'block');
})

$('.app_cover_tip_box').on('click', '.app_tip_next_btn', function () {
    let amount = $('.app_tip_amount_input').val();
    if(!amount){
        return;
    }
    $('.app_cover_tip_box').css('display', 'none');
    $('.app_cover_scan_container').css('display', 'block');
    let content = {
        "flag": "cyfs", 
        "type": "pay", 
        "data": {
            "chain": "cyfs", 
            "coin": "ecc", 
            "value": amount, 
            "address": g_appId
        }
    };
    QRCode.toCanvas(document.getElementById('app_tip_scan_box'), JSON.stringify(content), {
        errorCorrectionLevel: 'L',
        width: 112,
        height: 112,
        margin: 0
    });
})

$('.app_cover_tip_box .app_tip_amount_input').on('keyup', function () {
    let amount = $('.app_tip_amount_input').val();
    if(!amount){
        return;
    }
    let payment = Number(amount) + 100 * Math.pow(10, -8);
    $('.app_tip_payment').text(payment);
})


$(".app_detail_version_tbody").on('click', '.app_detail_version_install', async function () {
    await AppDetailUtil.addToStore(g_appId, g_owner);
    let version = $(this).attr('data-version');
    if(version){
        await AppDetailUtil.installApp(g_appId, g_owner, version);
    }
    appManager.renderVersionList();
})

$(".app_detail_software_list li, .app_detail_share_box i").on('click', function () {
    let url = $(this).attr('data-url');
    if(url){
        window.open(url);
    }
})

$(".app_subtitle_installed_box").on('click', '.select_update_installed_btn', function () {
    window.location.href = 'cyfs://static/DecAppStore/app_detail.html?id=' + g_appId;
})

$(".app_subtitle_installed_box").on('click', '.update_installed_btn', async function () {
    $('.app_subtitle_installed_box .update_installed_btn').prop("disabled", true);
    let operateAppRet:boolean = await AppDetailUtil.installApp(g_appId, g_owner, g_app.fidArray[g_app.fidArray.length-1].version);
    // if(operateAppRet){
    //     window.location.reload();
    // }
})

$(".app_subtitle_installed_box").on('click', '.uninstall_installed_btn', async function () {
    let operateAppRet:boolean = await AppDetailUtil.operateApp(g_appId, g_owner, 'uninstall');
    if(operateAppRet){
        window.location.href = 'cyfs://static/DecAppStore/app_store_list.html?installed';
    }
})

$('.app_header_box').on('click', '.people_head_sculpture', function () {
    window.location.href = 'cyfs://static/info.html';
})

$('.app_subtitle_detail_box').on('click', '.to_tip_list', function () {
    window.location.href = 'cyfs://static/DecAppStore/app_like_tip_list.html?id=' + g_appId;
})

$('.installed_status_checkbox').on('click', '.operate_btn', async function (event) {
    $('.operate_btn').css('display', 'none');
    $('.app_status_loading').css('display', 'block');
    event.stopImmediatePropagation();
    let operateAppRet:boolean;
    if(g_isStart){
        operateAppRet = await AppDetailUtil.operateApp(g_appId, g_owner, 'start');
    }else{
        operateAppRet = await AppDetailUtil.operateApp(g_appId, g_owner, 'stop');
    }
})
