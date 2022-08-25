import $ from 'jquery';
import * as cyfs from '../../cyfs_sdk/cyfs'
import { toast } from '../lib/toast.min'
import { ObjectUtil, formatDate, LANGUAGESTYPE } from '../lib/util'
import { isBind, AppUtil, AppDetailUtil } from './app_util'

let g_isBind:boolean;
let g_installedList:{ app_id: cyfs.ObjectId | string, app_name: string, fidArray: { fid: cyfs.ObjectId, version: string, summary: string }[], version: string, status:number, app_icon: string, owner: cyfs.ObjectId | undefined, app: cyfs.DecApp, webdir: cyfs.DirId |undefined, summary: string, auto_update: boolean, app_status: cyfs.AppLocalStatus }[];
let g_owner: cyfs.ObjectId;
let g_uninstallId: string;
let g_firstOpenSetting: boolean = true;
let g_getListInterval: NodeJS.Timeout | null = null;

$(async function(){
    if(LANGUAGESTYPE == 'zh'){
        $('title').html('已安装应用');
    }else{
        $('title').html('Dec App Installed');
    }
    let g_isBind = await isBind();
    if(!g_isBind){
        window.location.href = 'cyfs://static/browser.html';
    }else{
        g_getListInterval = setInterval(async () => {
            appManager.getAppList();
        }, 10 * 1000);
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
          result = result.unwrap()
        }
        let current_device = result.device
        g_owner = current_device.desc().owner().unwrap();
    }

    // get app installed list
    async getAppList() {
        const list_ret = await AppUtil.getAllAppListFun();
        console.origin.log('app installed list result:', list_ret);
        if (list_ret.err || !list_ret.app_list().size) {
            $('.app_tag_list').html(LANGUAGESTYPE == 'zh'? '无' : 'None');
        } else {
            console.origin.log('app installed list:', list_ret.app_list().array());
            let app_installed_list:{ app_id: cyfs.ObjectId | string, app_name: string, fidArray: { fid: cyfs.ObjectId, version: string, summary: string }[], version: string, status:number, app_icon: string, owner: cyfs.ObjectId | undefined, app: cyfs.DecApp, webdir: cyfs.DirId |undefined, summary: string, auto_update: boolean, app_status: cyfs.AppLocalStatus } []= [];
            for (const appid of list_ret.app_list().array()) {
                console.log('appid.object_id:', appid.object_id)
                let app = await AppUtil.handleAppDetail(appid.object_id);
                console.origin.log('------------showApp-app', app);
                let app_status = app.status;
                if(app_status != cyfs.AppLocalStatusCode.Init && app_status != cyfs.AppLocalStatusCode.Uninstalled){
                    app_installed_list.push(app);
                }
            }
            g_installedList = await app_installed_list.sort(appManager.sortNumber);
            $('.app_installed_setting_i').css('display', 'block');
            let installHtml:string = '';
            $('.app_tag_list').html('');
            for (const app of app_installed_list) {
                console.origin.log('------------app-detail', app);
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
                installHtml =   `<li>
                                    <div class="app_tag_img_box float_l" data-id="${app.app_id}">
                                        <img src="${app.app_icon || '../img/app/app_default_icon.svg'}" alt="" onerror="this.src='./img/app/app_default_icon.svg';this.οnerrοr=null">
                                    </div>
                                    <div class="float_l app_installed_info_box">
                                        ${app.fidArray[app.fidArray.length-1].version != app.version?`<i class="app_installed_update"  data-id="${app.app_id}"></i>`:''}
                                        <p class="app_tag_title" data-id="${app.app_id}">${app.app_name}<span class="appp_installed_version">(V ${app.version})</span></p>
                                        <p class="app_tag_info">${app.summary?app.summary:(LANGUAGESTYPE == 'zh'?'暂未介绍': 'No introduction yet')}</p>
                                        <p class="app_tag_p">
                                            <label class="switch_label switch_animbg float_l">
                                                <input class="app_status_switch" type="checkbox" ${app.status == cyfs.AppLocalStatusCode.Running?'checked':''} name="${app.app_name}_${app.app_id}" data-id="${app.app_id}"><i class="switch_i"></i>
                                            </label>
                                            <i class="float_l app_installed_status_i"></i>
                                            <span class="float_l app_installed_status">${appStr}</span>
                                            <button class="app_primary_btn app_uninstall_btn float_r"  data-id="${app.app_id}">${LANGUAGESTYPE == 'zh'?'卸载': 'Uninstall'}</button>
                                            <button class="app_primary_btn app_detail_btn float_r"  data-id="${app.app_id}">${LANGUAGESTYPE == 'zh'?'详情': 'Detail'}</button>
                                        </p>
                                    </div>
                                </li>`;
                $('.app_tag_list').append(installHtml);
            }
        }
    }
    sortNumber(a,b){
        return b.app.body().unwrap().update_time() - a.app.body().unwrap().update_time();
    }
}

const appManager = new AppManager();
appManager.getOwner();
appManager.getAppList();

$('.app_tag_list').on("click", '.app_tag_img_box, .app_tag_title, .app_detail_btn', function () {
    let id = $(this).attr("data-id");
    console.log('------id', id);
    window.open('cyfs://static/DecAppStore/app_detail.html?type=installed&id=' + id);
})

$('.app_cover_box').on('click', '.close_cover_i, .app_installed_no_btn', function () {
    $('.app_cover_box').css('display', 'none');
})

$('.app_cover_box').on('click', '.app_installed_yes_btn', async function () {
    let operateAppRet:boolean = await AppDetailUtil.operateApp(g_uninstallId, g_owner, 'uninstall');
    appManager.getAppList();
    $('.app_cover_box').css('display', 'none');
})

$(".app_tag_list").on('click', '.app_uninstall_btn', async function (event) {
    g_uninstallId = $(this).attr('data-id') || '';
    console.log('uninstall', g_uninstallId);
    $('.app_installed_confirm_container').css('display', 'block');
})

$('.app_installed_setting_i').on('click', function () {
    $('.app_installed_setting_container').css('display', 'block');
    if(g_firstOpenSetting){
        g_firstOpenSetting = false;
        let liHtml:string = '';
        let allUpdate:boolean = false;
        let i = 0;
        for (const app of g_installedList) {
            if(app.auto_update){
                i++;
            }
        }
        if(i == g_installedList.length){
            allUpdate = true;
            $('.automatic_update_all').prop("checked", true);
        }
        for (const app of g_installedList) {
            liHtml  +=  `<li>
                            <span>${app.app_name}</span>
                            <label class="switch_label switch_animbg float_r">
                                <input class="automatic_update_switch" type="checkbox" ${app.auto_update?'checked':''} name="${app.app_id}" data-id="${app.app_id}" ${allUpdate?'disabled':''}><i class="switch_i"></i>
                            </label>
                        </li>`
        }
        
        $('.app_installed_setting_ul').html(liHtml);
    }
})


$(".app_cover_installed_setting_box").on('click', '.automatic_update_switch', async function (event) {
    // get switch val
    event.stopImmediatePropagation();
    let name = $(event.target).attr('name');
    if(!name){
        return;
    }
    var isOpen = $(".app_cover_installed_setting_box .automatic_update_switch[name='" + name + "']:checked").length > 0 ? true : false;
    console.log('switch:', name, isOpen);
    if(name == 'automaticUpdateAll'){
        for (const app of g_installedList) {
            $('.app_installed_setting_ul .automatic_update_switch').prop({"checked":isOpen, 'disabled':isOpen});
            AppDetailUtil.setAppAutoUpdate(app.app_id.toString(), g_owner, isOpen);
        }
    }else{
        await AppDetailUtil.setAppAutoUpdate(name, g_owner, isOpen);
    }
    appManager.getAppList();
})

$(".app_tag_list").on('click', '.app_status_switch', async function (event) {
    event.stopImmediatePropagation();
    let name = $(event.target).attr('name');
    let id = $(event.target).attr('data-id');
    var isRun = $(".app_tag_list .app_status_switch[name='" + name + "']:checked").length > 0 ? true : false;
    if(!name || !id){
        $(".app_tag_list .app_status_switch[name='" + name + "']:checked").prop("checked", !isRun);
        return;
    }
    console.log('switch-name:', name, id, isRun);
    let operateAppRet:boolean;
    if(isRun){
        operateAppRet = await AppDetailUtil.operateApp(id, g_owner, 'start');
    }else{
        operateAppRet = await AppDetailUtil.operateApp(id, g_owner, 'stop');
    }
    if(!operateAppRet){
        $(".app_tag_list .app_status_switch[name='" + name + "']").prop("checked", !isRun);
    }
})

$(".app_tag_list").on('click', '.app_installed_update', function (event) {
    let id = $(this).attr('data-id');
    window.location.href = 'cyfs://static/DecAppStore/app_detail.html?id=' + id;
})

$('.app_header_box').on('click', '.people_head_sculpture', function () {
    window.location.href = 'cyfs://static/info.html';
})
