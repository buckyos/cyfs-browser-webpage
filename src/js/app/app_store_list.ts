import $ from 'jquery';
import * as cyfs from '../../cyfs_sdk/cyfs'
import { toast } from '../lib/toast.min'
import { ObjectUtil, formatDate, LANGUAGESTYPE } from '../lib/util'
import { isBind, AppUtil, AppDetailUtil, appDetailUtilType, storageAppUtilType } from './app_util'

let g_isBind:boolean;

$(async function(){
    if(LANGUAGESTYPE == 'zh'){
      $('title').html('应用商店');
    }else{
      $('title').html('Dec App Store');
    }
    g_isBind = await isBind();
    if(!g_isBind){
      window.location.href = 'cyfs://static/browser.html';
    }
});
type g_appType = { app_id: cyfs.ObjectId | string, app_name: string, app_icon: string, fidArray: { fid: cyfs.ObjectId, version: string }[], owner: cyfs.ObjectId | undefined, app: cyfs.DecApp };
let g_appList: g_appType[] = [];
let g_installedAppList: appDetailUtilType[] = [];
let g_isGettingList:boolean = false;
let g_owner: cyfs.ObjectId;
let g_isInstalled:boolean = false;
let g_uninstallId: string;
let g_hasStorageList:boolean = false;
let g_isInstalledPage: boolean = false;
let g_isShowSetting: boolean = false;
let g_appStorgeList: storageAppUtilType[] = [];

class AppStoreListClass {
    m_sharedStatck: cyfs.SharedCyfsStack;
    m_util_service: cyfs.UtilRequestor;
    m_router: cyfs.NONRequestor;

    constructor() {
        this.m_sharedStatck = cyfs.SharedCyfsStack.open_runtime(cyfs.get_system_dec_app().object_id);
        this.m_router = this.m_sharedStatck.non_service();
        this.m_util_service = this.m_sharedStatck.util();
    }

    async getOwner () {
      let result = await this.m_util_service.get_device({ common: { flags: 0 } });
      if (!result.err) {
        result = result.unwrap()
      }
      let current_device = result.device
      g_owner = current_device.desc().owner();
    }
    //app store list
    async getAllAppList() {
      let r = await AppUtil.getAllAppListFun();
      console.origin.log('-------------r', r)
      if (r.err) {
          $('.app_list_box').html(LANGUAGESTYPE == 'zh'? '无' : 'None');
      } else {
          let storeList = r.app_list().array();
          console.origin.log('storeList', storeList)
          if (storeList && storeList.length) {
            let getAppListPromise:Promise<{ fid: cyfs.ObjectId, version: string, summary: string } |cyfs.Result>[] = [];
            for (let i = 0; i < storeList.length; i++) {
              getAppListPromise.push(AppUtil.showApp(storeList[i].object_id, false));
            }
            let appList:{ app_id: cyfs.ObjectId | string, app_name: string, app_icon: string, fidArray: { fid: cyfs.ObjectId, version: string, summary: string }[], owner: cyfs.ObjectId | undefined, app: cyfs.DecApp, extId: cyfs.ObjectId }[] = [];
            if(getAppListPromise){
              Promise.allSettled(getAppListPromise).then((list) => {
                list.forEach((item, index) => {
                    if(item.status == 'fulfilled' && item.value && !item.value.err){
                      let app:{ app_id: cyfs.ObjectId | string, app_name: string, app_icon: string, fidArray: { fid: cyfs.ObjectId, version: string, summary: string }[], owner: cyfs.ObjectId | undefined, app: cyfs.DecApp, extId: cyfs.ObjectId } = item.value;
                      app.extId = cyfs.AppExtInfo.getExtId(app.app);
                      appList.push(app);
                    }
                });
                appList.sort(function(a,b){
                  if(a!.app.body()!.update_time() > b!.app.body()!.update_time()) return -1;
                  if(a!.app.body()!.update_time() < b!.app.body()!.update_time()) return 1;
                  return 0;
                });
                g_appList = appList;
                console.origin.log('------------app-appList', appList);
              }).then(async() => {
                let getAppExtListPromise:Promise<cyfs.Result<cyfs.AppExtInfo>>[] = [];
                  for (let i = 0; i < appList.length; i++) {
                    getAppExtListPromise.push( ObjectUtil.getObject({id:appList[i].extId, decoder:new cyfs.AppExtInfoDecoder, flags: 1}));
                  }
                  let appExtList:{id:string, tagsHtml:string, tag: string[] }[] = [];
                  Promise.allSettled(getAppExtListPromise).then((extlist) => {
                    extlist.forEach((extItem, extIndex) => {
                        if(extItem.status == 'fulfilled' && extItem.value && !extItem.value.err){
                          let info = JSON.parse(extItem.value[0].info());
                          let tags:string[] = [];
                          let tagsHtml:string = '';
                          if (info && info['cyfs-app-store']){
                            if(info['cyfs-app-store'].tag){
                                tags = info['cyfs-app-store'].tag;
                                tags.forEach(tag => {
                                  tagsHtml += `<span data-tag="${tag}"># ${tag}</span>`;
                                });
                            }
                          }
                          appExtList.push({id:extItem.value[0].desc().calculate_id().to_base_58() ,tagsHtml: tagsHtml, tag: tags})
                        }
                    });
                  }).then(() => {
                    let appStorageList: storageAppUtilType[] = [];
                    let storeHtml:string = '';
                    for (let i = 0; i < appList.length; i++) {
                      let app = appList[i]
                      let appBody = app.app.body();
                      let app_introduce:string = 'No introduction yet';
                      if (appBody!.content().desc) {
                        app_introduce = appBody!.content().desc!;
                      }
                      let tags:string[] = [];
                      let tagsHtml:string = '';
                      if(app.extId){
                        console.origin.log('app.extId', app.extId)
                        var result = $.grep(appExtList, function(e:{id:string, tagsHtml:string, tag: string[] }){return e.id == app.extId.to_base_58(); });
                        console.origin.log('result', result)
                        if(result.length != 0){
                          tags = result[0].tag;
                          tagsHtml = result[0].tagsHtml;
                        }
                      }
                      let storageApp:storageAppUtilType = {
                        id: app.app_id,
                        icon: app.app_icon || `../img/app/app_default_icon.svg`,
                        name: app.app_name,
                        tags: tags,
                        introduce: app_introduce
                      };
                      appStorageList.push(storageApp);
                      storeHtml +=  `<li>
                                      <div class="app_list_info">
                                        <div class="app_list_info_l" data-id="${app.app_id}">
                                          <img src="${app.app_icon || '../img/app/app_default_icon.svg'}" onerror="this.src='../img/app/app_default_icon.svg';this.οnerrοr=null" alt="">
                                        </div>
                                        <div class="app_list_info_r">
                                          <p class="app_list_info_title" data-id="${app.app_id}">${ app.app_name}</p>
                                          <p class="app_list_info_subtitle">${app_introduce}</p>
                                        </div>
                                      </div>
                                      <div class="app_list_extra_info">
                                        <div class="app_list_extra_info_l">${tagsHtml}</div>
                                        <div class="app_list_extra_info_r"></div>
                                      </div>
                                    </li>`;
                    }
                    g_appStorgeList = appStorageList;
                    if(g_appStorgeList){
                      $('.app_list_box').html(storeHtml);
                    }
                    localStorage.setItem('browser-app-store-list', JSON.stringify(appStorageList));
                    AppStoreList.getInstalledAppList();
                  });
              });
            }
          }
      }
      console.origin.log('------------------------------g_appList', g_appList)
    }
    
    async getStorageAppList () {
      let list:string|null = localStorage.getItem('browser-app-store-list');
      if(list){
        g_hasStorageList = true;
        let appList: storageAppUtilType[] = JSON.parse(list);
        console.origin.log('----------appList---r', appList)
        let r = await AppUtil.getAllAppListFun();
        console.origin.log('-------------r', r)
        if (!r.err) {
          let storeList = r.app_list().array();
          appList.forEach(app => {
            var result = $.grep(storeList, function(e:cyfs.DecAppId){return e.object_id.to_string() == app.id; });
            if(result.length != 0){
              g_appStorgeList.push(app);
            }
          });
        }
        console.origin.log('g_appStorgeList', g_appStorgeList)
        AppStoreList.getInstalledAppList(g_appStorgeList, true);
        for (let index = 0; index < g_appStorgeList.length; index++) {
          const app = g_appStorgeList[index];
          let tagsHtml:string = '';
          if(app.tags){
            app.tags.forEach(tag => {
              tagsHtml += `<span data-tag="${tag}"># ${tag}</span>`;
            });
          }
          let appHtml = `<li>
                          <div class="app_list_info">
                            <div class="app_list_info_l" data-id="${app.id}">
                              <img src="${app.icon || '../img/app/app_default_icon.svg'}" onerror="this.src='../img/app/app_default_icon.svg';this.οnerrοr=null" alt="">
                            </div>
                            <div class="app_list_info_r">
                              <p class="app_list_info_title" data-id="${app.id}">${ app.name}</p>
                              <p class="app_list_info_subtitle">${app.introduce}</p>
                            </div>
                          </div>
                          <div class="app_list_extra_info">
                            <div class="app_list_extra_info_l">${tagsHtml}</div>
                            <div class="app_list_extra_info_r"></div>
                          </div>
                        </li>`;
          $('.app_list_box').append(appHtml);
        }
      }
    }
    
    async getInstalledAppList (list?:cyfs.AppLocalList | storageAppUtilType[], isStorageList?: boolean) {
      if(g_isGettingList){
        return;
      }
      g_isGettingList = true;
      let appList:appDetailUtilType[] = [];
      console.log('------------list, isStorageList', list, isStorageList);
      let getListPromise:Promise<appDetailUtilType|cyfs.Result>[] = [];
      if(list){
        if(isStorageList){
          for (let index = 0; index < (list as storageAppUtilType[]).length; index++) {
            const element = list[index];
            getListPromise.push( AppUtil.handleAppDetail(element.id));
          }
        }else{
          for (const appid of (list as cyfs.AppLocalList).app_list().array()) {
            console.log('appid.object_id:', appid.object_id);
            getListPromise.push( AppUtil.handleAppDetail(appid.object_id));
          }
        }
      }else{
        for (const appid of g_appList) {
          console.log('appid.app_id:', appid.app_id);
          getListPromise.push( AppUtil.handleAppDetail(appid.app_id));
        }
      }
      if(getListPromise){
        Promise.allSettled(getListPromise).then((list) => {
            list.forEach((item, index) => {
                if(item.status == 'fulfilled' && item.value && !item.value.err){
                    let app_status = item.value.status;
                    if(app_status != cyfs.AppLocalStatusCode.Init && app_status != cyfs.AppLocalStatusCode.Uninstalled){
                        console.origin.log('------------app-detail', item.value);
                        appList.push(item.value);
                    }
                }
              });
              appList.sort(function(a,b){
                if(a!.app!.body()!.update_time() > b!.app!.body()!.update_time()) return -1;
                if(a!.app!.body()!.update_time() < b!.app!.body()!.update_time()) return 1;
                return 0;
              });
              g_installedAppList = appList;
              g_isGettingList = false;
              console.origin.log('------------------------------g_installedAppList', g_installedAppList)
              if(g_isInstalled){
                AppStoreList.renderInstalledAppList();
              }
        });
      }
      
    }

    async renderInstalledAppList () {
      console.log('------------app-g_isGettingList', g_isGettingList);
      if(g_isGettingList){
        return;
      }
      let installedHtml:string = '';
      let installedFailedHtml:string = '';
      for (let index = 0; index < g_installedAppList.length; index++) {
        const app = g_installedAppList[index];
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
        if(app_status == cyfs.AppLocalStatusCode.InstallFailed || app_status == cyfs.AppLocalStatusCode.UninstallFailed){
          installedFailedHtml += `<li>
                                    <div class="app_tag_img_box float_l" data-id="${app.app_id}">
                                        <img src="${app.app_icon || '../img/app/app_default_icon.svg'}" alt="" onerror="this.src='../img/app/app_default_icon.svg';this.οnerrοr=null">
                                    </div>
                                    <div class="float_l app_installed_info_box">
                                        <p class="app_tag_title" data-id="${app.app_id}">${app.app_name}<span class="appp_installed_version">(V ${app.version})</span></p>
                                        <p class="app_tag_info">${app.summary?app.summary:(LANGUAGESTYPE == 'zh'?'暂未介绍': 'No introduction yet')}</p>
                                        <p >
                                            <span class="float_l app_installed_status">${appStr}</span>
                                            <button class="app_plain_btn app_uninstall_btn float_r"  data-id="${app.app_id}">${LANGUAGESTYPE == 'zh'?'卸载': 'Uninstall'}</button>
                                            <button class="app_primary_btn app_reinstall_btn float_r"  data-id="${app.app_id}">${LANGUAGESTYPE == 'zh'?'重装': 'Reinstall'}</button>
                                        </p>
                                    </div>
                                  </li>`;
        }else{
          let btnHtml:string = '';
          if(app_status == cyfs.AppLocalStatusCode.Installing || app_status == cyfs.AppLocalStatusCode.Starting ||app_status == cyfs.AppLocalStatusCode.Stopping || app_status == cyfs.AppLocalStatusCode. Uninstalling){
            btnHtml = `<img class="app_status_loading float_l" style="display:block" src="../img/app/app_status_loading.gif" />`;
          }else if(app.status == cyfs.AppLocalStatusCode.Running || app.status == cyfs.AppLocalStatusCode.StopFailed){
            btnHtml = `<button class="operate_btn float_l app_primary_btn" data-id="${app.app_id}" data-operation="stop">${LANGUAGESTYPE == 'zh'?'停止': 'stop'}</button>`;
          }else if(app.status == cyfs.AppLocalStatusCode.NoService || app.status == cyfs.AppLocalStatusCode.Uninstalled){
            btnHtml = ``;
          }else{
            btnHtml = `<button class="operate_btn float_l app_primary_btn" data-id="${app.app_id}" data-operation="start">${LANGUAGESTYPE == 'zh'?'启动': 'start'}</button>`;
          }
          console.log('----webdirwebdir',app.app_name, (app_status == cyfs.AppLocalStatusCode.NoService || app_status == cyfs.AppLocalStatusCode.Running) && app.webdir,  app.webdir)
          installedHtml += `<li>
                              <div class="app_tag_img_box float_l" data-id="${app.app_id}">
                                  <img src="${app.app_icon || '../img/app/app_default_icon.svg'}" alt="" onerror="this.src='../img/app/app_default_icon.svg';this.οnerrοr=null">
                              </div>
                              <div class="float_l app_installed_info_box">
                                  ${((app_status == cyfs.AppLocalStatusCode.NoService || app_status == cyfs.AppLocalStatusCode.Running) && app.webdir)?`<a class="app_installed_webdir" target="_blank"  href="cyfs://a.${app.app.calculate_id().to_base_36()}/${app.app.calculate_id()}/index.html"></a>`:''}
                                  <p class="app_tag_title" data-id="${app.app_id}">${app.app_name}<span class="appp_installed_version">(V ${app.version})</span>${app.fidArray[app.fidArray.length-1].version != app.version?`<button class="app_installed_update" data-id="${app.app_id}"><span>${LANGUAGESTYPE == 'zh'?'更新': 'update'}</span></button>`:''}</p>
                                  <p class="app_tag_info">${app.summary?app.summary:(LANGUAGESTYPE == 'zh'?'暂未介绍': 'No introduction yet')}</p>
                                  <p>
                                      ${btnHtml}
                                      <img class="app_status_loading float_l" src="../img/app/app_status_loading.gif" />
                                      <span class="float_l app_installed_status">${appStr}</span>
                                      <button class=" app_plain_btn app_uninstall_btn float_r"  data-id="${app.app_id}">${LANGUAGESTYPE == 'zh'?'卸载': 'Uninstall'}</button>
                                      <button class="app_primary_btn app_detail_btn float_r"  data-id="${app.app_id}">${LANGUAGESTYPE == 'zh'?'详情': 'Detail'}</button>
                                  </p>
                              </div>
                            </li>`;
        }
      }
      $('.app_installed_list').html(installedHtml);
      $('.app_installed_failed_list').html(installedFailedHtml);
      g_isShowSetting = true;
      if(($('.app_installed_list_box').css('display') == 'block') && g_isShowSetting){
        $('.app_installed_loading_box').css('display', 'none');
        $('.app_installed_setting_i').css('display', 'block');
      }
    }

    async setTimeGetList () {
      let r = await AppUtil.getAllAppListFun();
      console.origin.log('-------------r', r)
      if (r.err) {
      } else {
        AppStoreList.getInstalledAppList(r, false);
      }
      setTimeout(() => {
        AppStoreList.setTimeGetList();
      }, 30000);
    }

    async initPage () {
      await AppStoreList.getStorageAppList();
      AppStoreList.getAllAppList();
      AppStoreList.getOwner();
      setTimeout(() => {
        AppStoreList.setTimeGetList();
      }, 30000);
    }

}

export const AppStoreList = new AppStoreListClass;
AppStoreList.initPage();

$('.tab_install_btn').on('click', function () {
  g_isInstalled = true;
  $('.tab_all_btn, .tab_tag_btn').addClass('app_plain_btn').removeClass('app_primary_btn');
  $('.tab_install_btn').addClass('app_primary_btn').removeClass('app_plain_btn');
  $('.app_list_box, .open_install_app_btn, .tab_tag_btn, .app_tags_list_box').css('display', 'none');
  $('.app_installed_list_box').css('display', 'block');
  $('.app_title_box').html(LANGUAGESTYPE == 'zh'? '已安装列表' : 'Installed list');
  console.log('1111111', g_isShowSetting)
  if(g_isShowSetting){
    $('.app_installed_setting_i').css('display', 'block');
  }else{
    $('.app_installed_loading_box').css('display', 'block');
  }
  AppStoreList.renderInstalledAppList();
})

if (window.location.search.split("?")[1]) {
  let str = window.location.search.split("?")[1];
  if (str == 'installed') {
    g_isInstalledPage = true;
    $('.tab_install_btn').click();
  }
}
console.log('----g_isInstalledPage', g_isInstalledPage);

// open app detail
$('.app_list_box').on('click', '.app_list_info_l, .app_list_info_title', function () {
  let id = $(this).attr('data-id');
  window.open('cyfs://static/DecAppStore/app_detail.html?id=' + id);
})

// open install app pop
$('.open_install_app_btn').on('click', function () {
    $('.app_cover_box .app_cover_input').val('');
    $('.add_url_cover').css('display', 'block');
})

// close install app pop
$('.app_cover_box').on('click', '.app_cover_close_i', function () {
    $('.app_cover_box').css('display', 'none');
})

$('.app_upload_btn').on('click', function () {
  window.location.href = 'cyfs://static/DecAppStore/upload_dec_app.html';
})

// add app
$('.app_cover_box').on('click', '.app_cover_input_btn', function () {
    let coverInput:string = $('.app_cover_input ').val()?.toString() || '';
    console.log('coverInput.indexOf("cyfs://")', coverInput.indexOf("cyfs://"))
    if (coverInput.indexOf("cyfs://") == 0) {
      let txt = coverInput.replace('cyfs:/', 'http://127.0.0.1:38090');
      AppDetailUtil.getObjectId(txt);
      $('.app_cover_box').css('display', 'none');
      $('#cover_input').val("");
    } else {
      toast({
        message: LANGUAGESTYPE == 'zh'? '应用不存在': 'The Dec App does not exist.',
        time: 1500,
        type: 'warn'
      });
    }
})

$('.app_header_box').on('click', '.people_head_sculpture', function () {
  window.location.href = 'cyfs://static/info.html';
})

$('.tab_all_btn').on('click', function () {
  g_isInstalled = false;
  $('.app_title_box').html(LANGUAGESTYPE == 'zh'? '应用列表' : 'Dec App List');
  $('.tab_install_btn, .tab_tag_btn').addClass('app_plain_btn').removeClass('app_primary_btn');
  $('.tab_all_btn').addClass('app_primary_btn').removeClass('app_plain_btn');
  $('.app_installed_list_box, .app_installed_setting_i, .tab_tag_btn, .app_tags_list_box').css('display', 'none');
  $('.app_list_box, .open_install_app_btn').css('display', 'block');
})

$(".app_tag_list").on('click', '.operate_btn', async function (event) {
  let id = $(this).attr('data-id');
  let operation = $(this).attr('data-operation');
  if(!id || !operation){
    return;
  }
  $(this).css('display', 'none');
  $(this).siblings('.app_status_loading').css('display', 'block');
  console.log('operate_btn-id:', id);
  let operateAppRet:boolean;
  if(operation == 'start'){
      operateAppRet = await AppDetailUtil.operateApp(id, g_owner, 'start');
  }else{
      operateAppRet = await AppDetailUtil.operateApp(id, g_owner, 'stop');
  }
  if(!operateAppRet){
    $(this).css('display', 'block');
    $(this).siblings('.app_status_loading').css('display', 'none');
  }
})

$('.app_tag_list').on("click", '.app_tag_img_box, .app_tag_title, .app_detail_btn', function () {
  let id = $(this).attr('data-id');
  console.log('------id', id);
  if(!id){
    return;
  }
  window.open('cyfs://static/DecAppStore/app_detail.html?type=installed&id=' + id);
})

$('.app_tag_list').on("click", '.app_reinstall_btn', function () {
  let id = $(this).attr('data-id');
  console.log('------id', id);
  if(!id){
    return;
  }
  window.open('cyfs://static/DecAppStore/app_detail.html?id=' + id);
})

$('.app_cover_box').on('click', '.app_installed_yes_btn', async function () {
  let operateAppRet:boolean = await AppDetailUtil.operateApp(g_uninstallId, g_owner, 'uninstall');
  $('.app_cover_box').css('display', 'none');
})

$(".app_tag_list").on('click', '.app_uninstall_btn', async function (event) {
  g_uninstallId = $(this).attr('data-id') || '';
  console.log('uninstall', g_uninstallId);
  $('.app_installed_confirm_container').css('display', 'block');
})

$('.app_installed_setting_i').on('click', async function () {
  $('.app_installed_setting_ul').html('');
  $('.automatic_update_all_box').css('display', 'none');
  $('.app_installed_setting_container, .setting_app_status_loading').css('display', 'block');
  let r = await AppUtil.getAllAppListFun();
  console.origin.log('-------------r', r)
  if (r.err) {
  } else {
    await AppStoreList.getInstalledAppList(r, false);
  }
  let liHtml:string = '';
  let allUpdate:boolean = false;
  let i = 0;
  console.origin.log('g_installedAppList', g_installedAppList);
  for (const app of g_installedAppList) {
      if(app.auto_update){
          i++;
      }
  }
  if(i == g_installedAppList.length){
      allUpdate = true;
      $('.automatic_update_all').prop("checked", true);
  }
  for (const app of g_installedAppList) {
      liHtml  +=  `<li>
                      <span>${app.app_name}</span>
                      <label class="switch_label switch_animbg float_r">
                          <input class="automatic_update_switch" type="checkbox" ${app.auto_update?'checked':''} name="${app.app_id}" data-id="${app.app_id}" ${allUpdate?'disabled':''}><i class="switch_i"></i>
                      </label>
                  </li>`
  }
  $('.setting_app_status_loading').css('display', 'none');
  $('.automatic_update_all_box').css('display', 'block');
  $('.app_installed_setting_ul').html(liHtml);
})

$('.app_cover_box').on('click', '.close_cover_i, .app_installed_no_btn', function () {
  $('.app_cover_box').css('display', 'none');
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
      for (const app of g_installedAppList) {
          $('.app_installed_setting_ul .automatic_update_switch').prop({"checked":isOpen, 'disabled':isOpen});
          AppDetailUtil.setAppAutoUpdate(app.app_id.toString(), g_owner, isOpen);
      }
  }else{
      await AppDetailUtil.setAppAutoUpdate(name, g_owner, isOpen);
  }
})

$('.app_content_box').on('click', '.app_list_extra_info_l span, .app_tag_p span', function () {
  let tag = $(this).attr('data-tag');
  if(tag){
    $('.app_title_box').html(LANGUAGESTYPE == 'zh' ? `应用列表 - 标签(#${tag})` : `Dec App List - Tag(#${tag})`);;
    $('.tab_tag_btn').html('#'+tag).css('display', 'block').addClass('app_primary_btn').removeClass('app_plain_btn');
    $('.app_list_box, .app_installed_list_box').css('display', 'none');
    $('.tab_all_btn, .tab_install_btn').addClass('app_plain_btn').removeClass('app_primary_btn');
    $('.app_tags_list_box').css('display', 'block');
    let liHtml:string = '';
    for (let index = 0; index < g_appStorgeList.length; index++) {
      const element = g_appStorgeList[index];
      if(element.tags.indexOf(tag) > -1){
        let tagsHtml:string = '';
        element.tags?.forEach(tag => {
          tagsHtml += `<span data-tag="${tag}"># ${tag}</span>`;
        });
        liHtml  += `<li>
                      <div class="app_tag_img_box float_l">
                          <img src="${element.icon || '../img/app/app_default_icon.svg'}" alt="" onerror="this.src='../img/app/app_default_icon.svg';this.οnerrοr=null">
                      </div>
                      <div class="float_l app_installed_info_box">
                          <p class="app_tag_title">${element.name}</p>
                          <p class="app_tag_info">${element.introduce}</p>
                          <p class="app_tag_p">
                              ${tagsHtml}
                          </p>
                      </div>
                  </li>`;
      }
    }
    $('.app_tags_list').html(liHtml);
  }
  
})

$('.app_header_title').on('click', function () {
  window.location.href = 'cyfs://static/DecAppStore/app_store_list.html';
})
