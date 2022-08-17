import $ from 'jquery';
import * as cyfs from '../../cyfs_sdk/cyfs'
import { toast } from '../lib/toast.min'
let QRCode = require('qrcode')
import { ObjectUtil, formatDate, LANGUAGESTYPE, copyData } from '../lib/util'
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
        $('.app_detail_icon').attr('src', app.app_icon || '');
        let owner = null;
        let peopleName = null;
        if (app.app.desc().owner) {
            owner = g_appOwner = app.app.desc().owner().unwrap();
            const peopleR = (await ObjectUtil.getObject({ id: owner!, isReturnResult: true, flags: 1 })).object;
            console.origin.log('peopleR:', peopleR);
            peopleName = peopleR.object.name() || '';
        }
        $('.app_detail_dec_id_p').html(`<span class="app_detail_dec_id">Dec-ID：${g_appId}</span><i class="upload_app_info_id_copy" data-id="${g_appId}"></i>`)
        $('.app_detail_developer_p').html(`<span class="app_detail_developer">${LANGUAGESTYPE == 'zh'?'开发者：': 'Developer：'}${peopleName}  (${owner})</span><i class="upload_app_info_id_copy" data-id="${owner}"></i>`)
        // if(app.app.desc().dec_id().is_some()){
        //     let decid = app.app.desc().dec_id().unwrap();
        //     $('.app_detail_dec_id_p').html(`<span class="app_detail_dec_id">Dec-ID：${decid}</span><i class="upload_app_info_id_copy" data-id="${decid}"></i>`)
        // }
        let appBody = app.app.body().unwrap();
        let introduce:string = '';
        if (appBody.content().desc.is_some()) {
            g_overviewStr = introduce = appBody.content().desc.unwrap().toString();
        }else{
            introduce = LANGUAGESTYPE == 'zh'?'暂未介绍': 'No introduction yet';
        }
        $('.app_detail_overview').html(`<span  class="app_detail_overview_extra">${LANGUAGESTYPE == 'zh'?'简介': 'Overview'}：${introduce}</span>${introduce?`<span class="app_detail_overview_more">more</span>`:''}`);
        if(g_isInstalled){
            // app installed detail
            $('.app_detail_info_container, .app_subtitle_installed_box').css('display', 'block');

            appManager.renderAppInfo(id);
        }else{
            // app detail
            $('.app_detail_title').html(`${app.app_name}<i class="app_detail_version_share"></i>`);
            $('.app_detail_software_box, .app_detail_version_box, .app_subtitle_detail_box').css('display', 'block');
            appManager.renderVersionList();
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
            if (info.default && info.default['cyfs-app-store']){
                if(info.default['cyfs-app-store'].tag){
                    let tags = info.default['cyfs-app-store'].tag;
                    let html = '';
                    tags.forEach(tag => {
                        html += `<span>#${tag}</span>`;
                    });
                    $('.app_detail_tag_box').html(html);
                }
                if(info.default['cyfs-app-store'].client){
                    let clients = info.default['cyfs-app-store'].client;
                    if(clients.android){
                        $('.app_software_android').css('display', 'block').attr('data-url', clients.android);
                    }
                    if(clients.iOS){
                        $('.app_software_ios').css('display', 'block').attr('data-url', clients.iOS);
                    }
                    if(clients.windows){
                        $('.app_software_windows').css('display', 'block').attr('data-url', clients.windows);
                    }
                    if(clients.macOS){
                        $('.app_software_macos').css('display', 'block').attr('data-url', clients.macOS);
                    }
                    if(clients.linux){
                        $('.app_software_linux').css('display', 'block').attr('data-url', clients.linux);
                    }
                    if(clients.other){
                        $('.app_software_other').css('display', 'block').attr('data-url', clients.other);
                    }
                }
            }
        }
        }
    }

    async renderAppInfo (id) {
        let app = await AppUtil.handleAppDetail(id);
        if(app.version != app.fidArray[app.fidArray.length - 1].version){
            $('.update_installed_btn').css('display', 'block');
        }
        $('.app_detail_title').html(`${app.app_name}<span class="app_detail_subtitle">${app.version}</span><i class="app_detail_version_share"></i>`);
        console.origin.log('---------------app-info', app);
        $('.app_installed_version').html(app.version);
        $('.app_installed_summary').html(app.summary);
        // $('.app_installed_time').html(app.version);
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
                // <td>2022-06-15</td>
                appVersionsHtml =  `<tr>
                                        <td>
                                            <a class="app_detail_version">${element.version}</a>
                                        </td>
                                        <td>${element.summary}</td>
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
        width: 88,
        height: 88,
        margin: 0
    });
})

$(".app_detail_version_tbody").on('click', '.app_detail_version_install', async function () {
    await AppDetailUtil.addToStore(g_appId, g_owner);
    let version = $(this).attr('data-version');
    if(version){
        await AppDetailUtil.installApp(g_appId, g_owner, version);
    }
    appManager.renderVersionList();
})

$(".app_detail_software_list li").on('click', function () {
    let url = $(this).attr('data-url');
    if(url){
        window.open(url);
    }
})

$(".app_subtitle_installed_box").on('click', '.select_update_installed_btn', function () {
    window.location.href = 'cyfs://static/DecAppStore/app_detail.html?id=' + g_appId;
})

$(".app_subtitle_installed_box").on('click', '.update_installed_btn', async function () {
    let operateAppRet:boolean = await AppDetailUtil.installApp(g_appId, g_owner, g_app.fidArray[g_app.fidArray.length-1].version);
    if(operateAppRet){
        window.location.reload();
    }
})

$(".app_subtitle_installed_box").on('click', '.uninstall_installed_btn', async function () {
    let operateAppRet:boolean = await AppDetailUtil.operateApp(g_appId, g_owner, 'uninstall');
    if(operateAppRet){
        window.location.href = 'cyfs://static/DecAppStore/app_detail.html?id=' + g_appId;
    }
})

$('.app_header_box').on('click', '.people_head_sculpture', function () {
    window.location.href = 'cyfs://static/info.html';
})

