import * as cyfs from '../../cyfs_sdk/cyfs'
import {toast} from '../lib/toast.min'
import { ObjectUtil, LANGUAGESTYPE } from '../lib/util'

$(function(){
  if(LANGUAGESTYPE == 'zh'){
    $('title').html('应用管理');
  }else{
    $('title').html('DEC App Management');
  }
});

let APP_OWNER: cyfs.ObjectId;
let installAppList = [];
let allInstallList = [];
let allIdInstallList = [];
let IS_FITRST_GET:boolean = true;

class ObjectManager {
  m_sharedStatck: cyfs.SharedCyfsStack;
  m_util_service: cyfs.UtilRequestor;
  m_router: cyfs.NONRequestor;
  constructor() {
    this.m_sharedStatck = cyfs.SharedCyfsStack.open_runtime(cyfs.get_system_dec_app().object_id);
    this.m_router = this.m_sharedStatck.non_service();
    this.m_util_service = this.m_sharedStatck.util();
  }

  async getOodStatus() {
    // OOD连接状态信息
    let ood_status = await this.m_util_service.get_ood_status({ common: { flags: 0 } });
    if (!ood_status.err) {
      ood_status = ood_status.unwrap().status;
    }
    console.log('ood_status:', ood_status);
    if (ood_status.cont_fail_count >= 3) {
      $('.install_content_box').css('display', 'none');
      $('#store_list').css('display', 'none');
      $('.unconnect_ood').css('display', 'block');
    }
  }

  async showApp(id: cyfs.ObjectId | string, isRefresh: boolean) {
    let r: cyfs.DecApp;
    let ret = await ObjectUtil.getObject({id:id, decoder:new cyfs.DecAppDecoder });
    if (ret.err) {
      // alert(LANGUAGESTYPE == 'zh'? '失败': 'fail');
    } else {
      [r,] = ret;
    }
    if (isRefresh) {
      let owner = r.desc().owner().unwrap();
      let flags = isRefresh ? 1 : 0;
      let newRet = await ObjectUtil.getObject({id:id, decoder:new cyfs.DecAppDecoder,flags:flags, target:owner});
      if (newRet.err) {
        // alert(LANGUAGESTYPE == 'zh'? '刷新失败': 'Refresh failed');
      } else {
        [r,] = newRet;
        let putResult = await objectManager.putObj(r);
        if (putResult.err && putResult.val.code != cyfs.BuckyErrorCode.Ignored) {
          // alert(LANGUAGESTYPE == 'zh'? '刷新失败': 'Refresh failed');
        }
      }
    }
    if (ret.err) {
      console.log('showApp--r', r)
      return ret;
    } else {
      let get_app_status = await objectManager.getAppStatus(id);
      let app = r;
      console.origin.log('get_app_status', app.name(), get_app_status.version())
      let appObj: { app_id: cyfs.ObjectId | string, app_name: string, version: string, status:number, app_icon: string, owner: cyfs.ObjectId, app: cyfs.DecApp, webdir: cyfs.DirId |undefined } = {
        app_id: id,
        app_name: '',
        app_icon: '',
        owner: app.desc().owner().unwrap(),
        app: r,
        version: get_app_status.version(),
        status:  get_app_status.status(),
        webdir: get_app_status.webdir()
      };
      // 取app的名字和图标，icon可能为undefined
      appObj.app_name = app.name();
      appObj.app_icon = app.icon();
      // 遍历app的版本列表
      return appObj;
    }

  }

  async getOwner() {
    let result = await this.m_util_service.get_device({ common: { flags: 0 } });
    if (!result.err) {
      result = result.unwrap();
    }
    let current_device = result.device
    APP_OWNER = current_device.desc().owner().unwrap();
  }

  async getAppStatus(app_id) {
    const sysDecAppObjId = cyfs.get_system_dec_app().object_id;
    const path = cyfs.AppLocalStatus.get_path(app_id);
    const ret = await this.getObjectFromRootState(path, APP_OWNER, sysDecAppObjId, new cyfs.AppLocalStatusDecoder());
    console.origin.log('getAppStatus-ret', ret);
    return ret;
  }

  async putObj(obj) {
    const router = this.m_router;
    let buf_len = obj.raw_measure().unwrap();
    let buf = new Uint8Array(buf_len);
    obj.raw_encode(buf);
    let r = await router.put_object({
      object: new cyfs.NONObjectInfo(obj.desc().calculate_id(), buf),
      common: {
        level: cyfs.NONAPILevel.Router,
        flags: 0
      }
    });
    console.log('--------r', r)
    if (r.err && r.val.code != cyfs.BuckyErrorCode.Ignored) {
      return r;
    } else {
      return r;
    }
  }

  async removeApp(id) {
    let idObj;
    console.origin.log('installAppList: ', installAppList)
    allInstallList.forEach(app => {
      if (id == app.app_id) {
        console.origin.log('id, app.app_id: ',id, app.app_id)
        idObj = app.app_id;
      }
    });
    if(!idObj){
      return;
    }
    console.origin.log('idObj: ',id, idObj)
    let get_device_result = await this.m_util_service.get_device({ common: { flags: 0 } });
    if (!get_device_result.err) {
      get_device_result = get_device_result.unwrap()
    }
    let current_device = get_device_result.device
    console.log('current_device: ', current_device)
    let owner = current_device.desc().owner().unwrap();
    let cmdObj = cyfs.AppCmd.uninstall(owner, idObj);
    let result = await objectManager.postObj(cmdObj);
    console.log('卸载结果：', result);
    objectManager.getAppList();
    if (result.err && result.val.code != cyfs.BuckyErrorCode.Ignored) {
      toast({
        message: LANGUAGESTYPE == 'zh'? '卸载失败': 'Uninstall Failed',
        time: 1500,
        type: 'warn'
      });
    } else {
      toast({
        message:LANGUAGESTYPE == 'zh'? '卸载成功': 'Uninstall succeeded',
        time:1500,
        type: 'success'
      });
    }
  }

  // 已安装列表渲染
  async getAppList(name?: string) {
    const list_ret = await objectManager.getAppListFunc();
    let installList = document.getElementById('install_list');
    if(IS_FITRST_GET){
      $('#install_list').html('');
    }
    let installHtml = ``;
    let addInstallHtml = ``;
    installAppList = [];
    if (list_ret.err || !list_ret.app_list().size) {
      installList.innerHTML = LANGUAGESTYPE == 'zh'? '无' : 'None';
    } else {
      console.origin.log('已安装列表获取:', list_ret.app_list().array())
      let i = 0;
      for (const appid of list_ret.app_list().array()) {
        console.log('appid.object_id:', appid.object_id)
        let app = await objectManager.showApp(appid.object_id, false);
        console.origin.log('------------showApp-app', app);
        let app_status = app.status;
        if(app_status != cyfs.AppLocalStatusCode.Init && app_status != cyfs.AppLocalStatusCode.Uninstalled){
          let appImg = '../img/appmanager/installed_img.svg';
          if (app.app_icon) {
            appImg = app.app_icon;
          }
          if (app.app_name.indexOf(name) > -1 || !name) {
            console.log('------------app_status', app.app_name, app_status);
            let run_disabled = null;
            let stop_disabled = null;
            let uninstall_disabled = null;
            let open_dir = '';
            let appStr = "";
            if (app_status == cyfs.AppLocalStatusCode.Init) {
              appStr = LANGUAGESTYPE == 'zh'? '初始化' : 'Init';
            }else if(app_status == cyfs.AppLocalStatusCode.Installing){
              appStr = LANGUAGESTYPE == 'zh'? '安装中' : 'Installing';
            }else if(app_status == cyfs.AppLocalStatusCode.InstallFailed){
              appStr = LANGUAGESTYPE == 'zh'? '安装失败' : 'InstallFailed';
              run_disabled = 'disabled';
              stop_disabled = 'disabled';
            }else if(app_status == cyfs.AppLocalStatusCode.NoService){
              appStr = LANGUAGESTYPE == 'zh'? '无DEC服务' : 'NoService';
              run_disabled = 'disabled';
              stop_disabled = 'disabled';
              if (app.webdir) {
                console.log('get_app_status.webdir().to_base_58()', app.webdir.to_base_58())
                open_dir = `<a class="webdir_open_i" href="cyfs://o/${app.webdir.to_base_58()}/index.html" target="_blank"></a>`;
              }
            }else if(app_status == cyfs.AppLocalStatusCode.Stopping){
              appStr = LANGUAGESTYPE == 'zh'? '停止中' : 'Stopping';
              stop_disabled = 'disabled';
            }else if(app_status == cyfs.AppLocalStatusCode.Stop){
              appStr = LANGUAGESTYPE == 'zh'? '已停止' : 'Stop';
              stop_disabled = 'disabled';
            }else if(app_status == cyfs.AppLocalStatusCode.StopFailed){
              appStr = LANGUAGESTYPE == 'zh'? '停止失败' : 'StopFailed';
            }else if(app_status == cyfs.AppLocalStatusCode.Starting){
              appStr = LANGUAGESTYPE == 'zh'? '启动中' : 'Starting';
              run_disabled = 'disabled';
            }else if(app_status == cyfs.AppLocalStatusCode.Running){
              appStr = LANGUAGESTYPE == 'zh'? '运行中' : 'Running';
              run_disabled = 'disabled';
              if (app.webdir) {
                console.log('get_app_status.webdir().to_base_58()', app.webdir.to_base_58())
                open_dir = `<a class="webdir_open_i" href="cyfs://o/${app.webdir.to_base_58()}/index.html" target="_blank" ></a>`;
              }
            }else if(app_status == cyfs.AppLocalStatusCode.StartFailed){
              appStr = LANGUAGESTYPE == 'zh'? '启动失败' : 'StartFailed';
              stop_disabled = 'disabled';
            }else if(app_status == cyfs.AppLocalStatusCode.Uninstalling){
              appStr = LANGUAGESTYPE == 'zh'? '卸载中' : 'Uninstalling';
              uninstall_disabled = 'disabled';
            }else if(app_status == cyfs.AppLocalStatusCode.UninstallFailed){
              appStr = LANGUAGESTYPE == 'zh'? '卸载失败' : 'UninstallFailed';
            }else if(app_status == cyfs.AppLocalStatusCode.Uninstalled){
              appStr = LANGUAGESTYPE == 'zh'? '卸载成功' : 'Uninstalled';
            }else if(app_status == cyfs.AppLocalStatusCode.RunException){
              appStr = LANGUAGESTYPE == 'zh'? '运行异常' : 'RunException';
            }
            app.app_version = app.version;
            installAppList.push(app)
            if(allIdInstallList.indexOf(app.app_id) < 0){
              allInstallList.push(app);
              allIdInstallList.push(app.app_id.toString());
            }
            console.origin.log('-------------installAppList', installAppList)
            installHtml = ` <li>
                              <h3 class="installed_title">${app.app_name}</h3>
                              ${open_dir}
                              <div class="installed_img_box">
                                <img class="installed_img" src="${appImg}" alt="">
                              </div>
                              <p class="installed_introduce">
                                <span class="float_l" id="install_ver">V${app.version}</span>
                                <span class="float_r">${appStr}</span>
                              </p>
                              <div class="install_btn_box">
                                <button class="run_app_btn" ${run_disabled} data-index="${i}" data-appid="${appid.object_id}" data-version="${app.version}"
                                  data-isrun="true">${LANGUAGESTYPE == 'zh'?'运行': 'Run'}</button>
                                <button class="run_app_btn" ${stop_disabled} data-index="${i}" data-appid="${appid.object_id}"
                                  data-version="${app.version}" data-isrun="false">${LANGUAGESTYPE == 'zh'?'停止': 'Stop'}</button>
                                <button class="install_remove_btn" ${uninstall_disabled} data-index="${i}" data-appid="${appid.object_id}">${LANGUAGESTYPE == 'zh'?'卸载': 'Uninstall'}</button>
                              </div>
                            </li>`;
            i++;
            if(IS_FITRST_GET){
              $('#install_list').append(installHtml);
            }
            addInstallHtml =  addInstallHtml + installHtml ;
          }
        }
      }
      if(!IS_FITRST_GET){
        $('#install_list').html(addInstallHtml);
      }
      IS_FITRST_GET = false;
    }
  }

  async getObjectFromRootState(path, owner, decId, decoder) {
    console.origin.log('path, owner, decId, decoder', path, owner, decId, decoder);
    let m_root_state = this.m_sharedStatck.root_state_accessor_stub(owner, decId);
    const ret = await m_root_state.get_object_by_path(path);
    if (ret.err) {
      console.log('getAllAppListFun-ret-err', ret);
      return ret;
    }
    const retDecoder = decoder.raw_decode(ret.unwrap().object.object_raw);
    if (retDecoder.err) {
      console.log('retDecoder-ret-err', ret);
      return retDecoder;
    }
    const [obj, _] = retDecoder.unwrap();
    console.origin.log('retDecoder-ret', obj);
    return obj;
  }

  //已安装列表获取
  async getAppListFunc() {
    let result = await this.m_util_service.get_device({ common: { flags: 0 } });
    if (!result.err) {
      result = result.unwrap()
    }
    let current_device = result.device
    console.log('current_device: ', current_device)
    let owner = current_device.desc().owner().unwrap();
    const sysDecAppObjId = cyfs.get_system_dec_app().object_id;
    let ret = await this.getObjectFromRootState(cyfs.APP_LOCAL_LIST_PATH, owner, sysDecAppObjId, new cyfs.AppLocalListDecoder())
    return ret;
  }

  async postObj(obj) {
    const router = this.m_router;
    let buf_len = obj.raw_measure().unwrap();
    let buf = new Uint8Array(buf_len);
    obj.raw_encode(buf);
    console.log('-------post_object-req_path', {
      object: new cyfs.NONObjectInfo(obj.desc().calculate_id(), buf),
      common: {
        level: cyfs.NONAPILevel.Router,
        flags: 0,
        req_path: null
      }
    })

    let r = await router.post_object({
      object: new cyfs.NONObjectInfo(obj.desc().calculate_id(), buf),
      common: {
        level: cyfs.NONAPILevel.Router,
        flags: 0,
        req_path: null
      }
    });
    console.origin.log('-------post_object-r', r)
    if (r.err && r.val.code != cyfs.BuckyErrorCode.Ignored) {
      return r;
    } else {
      return r;
    }
  }

  async installAllFun(id: string, ver: string, status: boolean, isStop?: boolean) {
    let idObj: cyfs.DecAppId;
    let idResult = cyfs.ObjectId.from_base_58(id);
    if (idResult.err) {
      toast({
        message: LANGUAGESTYPE == 'zh'? 'Id格式不对': 'wrong ID format',
        time: 1500,
        type: 'warn'
      });
    } else {
      idObj = idResult.unwrap()
    }
    console.log('id, ver, status, isStop:', id, ver, status, isStop)
    let result = await this.m_util_service.get_device({ common: { flags: 0 } });
    if (!result.err) {
      result = result.unwrap()
    }
    let current_device = result.device
    console.log('current_device: ', current_device)
    let owner = current_device.desc().owner().unwrap();
    let cmdObj;
    if (isStop) {
      cmdObj = cyfs.AppCmd.stop(owner, idObj);
    } else {
      cmdObj = cyfs.AppCmd.start(owner, idObj);
    }
    console.log('cmdObj: ', cmdObj)
    let r = await objectManager.postObj(cmdObj);
    console.log('安装:', r);
    objectManager.getAppList();
    if (r.err && r.val.code != cyfs.BuckyErrorCode.Ignored) {
      if (status) {
        toast({
          message: LANGUAGESTYPE == 'zh'? '运行失败！': 'Run failed',
          time:1500,
          type: 'warn'
        });
      } else {
        if (isStop) {
          toast({
            message: LANGUAGESTYPE == 'zh'? '停止失败！': 'Stop failed',
            time:1500,
            type: 'warn'
          });
        } else {
        }
      }
      return r;
    } else {
      if (status) {
        toast({
          message: LANGUAGESTYPE == 'zh'? '运行成功！': 'Run successfully',
          time:1500,
          type: 'success'
        });
      } else {
        if (isStop) {
          toast({
            message: LANGUAGESTYPE == 'zh'? '停止成功！': 'Stop successfully',
            time:1500,
            type: 'success'
          });
        } else {
        }
      }
    }
  }

}

const objectManager = new ObjectManager();

let ANONYMOUS_STATUS:boolean;
let getListInterval: NodeJS.Timeout | null = null;
$.ajax({
    url: 'http://127.0.0.1:38090/status',
    success: async function(result){
        console.log('getStatus-result', result);
        ANONYMOUS_STATUS = result.anonymous;
        if(result.anonymous){
            $('.anonymous_box').css('display', 'block');
            $('.app_box').css('display', 'none');
        }else{
          if (result.is_bind) {
            await objectManager.getOwner();
            objectManager.getOodStatus();
            getListInterval = setInterval(async () => {
              objectManager.getAppList();
            }, 10 * 1000);
            objectManager.getAppList();
          } else {
            $('.install_content_box').css('display', 'none');
            $('#store_list').css('display', 'none');
            $('.unconnect_ood').css('display', 'block');
          }
        }
    }
});

$('.anonymous_subtitle').on('click', async function () {
  window.open('cyfs://static/guide.html');
})

$("#install_list").on("click", ".install_remove_btn", function () {
  let id = $(this).attr("data-appid");
  removeAppFun(id);
})

let removerId = "";
function removeAppFun(id) {
  removerId = id;
  console.log('removerId', removerId)
  openRemoveCover();
}

$("#install_list").on("click", '.install_btn_box button', function () {
  let index = Number($(this).attr("data-index"));
  $("#install_list li").eq(index).children('.install_btn_box').children().attr('disabled', 'disabled');
})

$("#install_list").on("click", ".run_app_btn", function () {
  let id = $(this).attr("data-appid");
  let version = $(this).attr("data-version");
  let isRun = eval($(this).attr("data-isrun").toLowerCase());
  runAppFun(id, version, isRun);
})

function runAppFun(id, appVersionVal, isRun) {
  console.log('id, appVersionVal, isRun', id, appVersionVal, isRun)
  if (!isRun) {
    objectManager.installAllFun(id, appVersionVal, isRun, true);
  } else {
    objectManager.installAllFun(id, appVersionVal, isRun);
  }
}

function openRemoveCover() {
  let coverBox = document.getElementById('remove_box');
  coverBox.style.display = 'block';
}
$('.cover_box').on('click', '.close_svg', function () {
  console.log('111111111111')
  closeRemoveCover()
})
$('.cancel_remove_btn').on('click', (event) => {
  closeRemoveCover()
})
function closeRemoveCover() {
  let coverBox = document.getElementById('remove_box');
  coverBox.style.display = 'none';
}

$('.comfirm_remove_btn').on('click', (event) => {
  removeAppConfirm()
})

function removeAppConfirm() {
  objectManager.removeApp(removerId);
  closeRemoveCover();
}
