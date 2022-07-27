import $ from 'jquery';
import * as cyfs from '../../cyfs_sdk/cyfs'
import { toast } from '../lib/toast.min'
import { ObjectUtil, formatDate, LANGUAGESTYPE } from '../lib/util'
import { isBind, AppUtil } from './app_util'

let g_appId:string = '';
let g_version:string = '';
let g_isBind:boolean;
let g_appOwner:cyfs.ObjectId;
let g_versionInstalled:string;
let g_statusInstalled:number;

$(async function(){
    isBind();
    if(LANGUAGESTYPE == 'zh'){
      $('title').html('应用详情');
    }else{
      $('title').html('DEC App Detail');
    }
    g_isBind = await isBind();
    if(!g_isBind){
      window.location.href = 'cyfs://static/browser.html';
    }
});

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
        }
    }
}
console.log('---------g_appId, g_version:', g_appId, g_version);

class AppManager {
    m_sharedStatck: cyfs.SharedCyfsStack;
    m_util_service: cyfs.UtilRequestor;
    m_router: cyfs.NONRequestor;
    constructor() {
      this.m_sharedStatck = cyfs.SharedCyfsStack.open_runtime();
      this.m_router = this.m_sharedStatck.non_service();
      this.m_util_service = this.m_sharedStatck.util();
    }

    async initData(id:string) {
        let app = await AppUtil.showApp(id, true);
        console.origin.log('---------app-data:', app);
        $('.app_detail_icon').attr('src', app.app_icon || '');
        $('.app_detail_title').html(app.app_name || '');
        let owner = null;
        if (app.app.desc().owner) {
            owner = g_appOwner = app.app.desc().owner().unwrap();
            $('.app_detail_developer').html(`${LANGUAGESTYPE == 'zh'?'开发者：': 'Developer：'}CYFS  (${owner})`)
        }
        if(app.app.desc().dec_id().is_some()){
            let decid = app.app.desc().dec_id().unwrap();
            $('.app_detail_dec_id').html(`Dec-ID：${decid}`)
        }
        let appBody = app.app.body().unwrap();
        let introduce = LANGUAGESTYPE == 'zh'?'简介：暂未介绍': 'Overview：No introduction yet';
        if (appBody.content().desc.is_some()) {
            introduce = appBody.content().desc.unwrap().toString();
            $('.app_detail_overview_extra').html(`${LANGUAGESTYPE == 'zh'?'简介': 'Overview'}：${introduce}`);
        }
        appManager.renderVersionList(id, app);
    }

    async renderVersionList(id, app){
        let appStatus = await AppUtil.getAppStatus(id);
        console.origin.log('getAppStatus-ret-err', appStatus);
        if (appStatus.err) {
            return;
        }
        g_versionInstalled = appStatus.version();
        g_statusInstalled = appStatus.status();
        let appVersionsHtml = '';
        if (app.fidArray.length > 0) {
            app.fidArray.forEach(element => {
                appVersionsHtml +=  `<tr>
                                        <td>
                                        <a class="app_detail_version">${element.version}</a>
                                        </td>
                                        <td>${element.summary}</td>
                                        <td>2022-06-15</td>
                                        <td>
                                            ${(g_versionInstalled != element.version || g_statusInstalled == cyfs.AppLocalStatusCode.Init || g_statusInstalled == cyfs.AppLocalStatusCode.InstallFailed || g_statusInstalled == cyfs.AppLocalStatusCode.Uninstalled)?`<button class="app_primary_btn app_detail_version_install">${LANGUAGESTYPE == 'zh'?'安装': 'install'}</button>`:`<button class="app_disable_btn app_detail_version_installed">${LANGUAGESTYPE == 'zh'?'已安装': 'installed'}</button>`}
                                            <i class="app_detail_version_share"></i>
                                        </td>
                                    </tr>`;
            });
            $('.app_detail_version_tbody').html(appVersionsHtml);
        };
    }
}

const appManager = new AppManager();
appManager.initData(g_appId);

