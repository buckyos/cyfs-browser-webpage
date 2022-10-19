import * as cyfs from '../../cyfs_sdk/cyfs'
import $ from 'jquery';
import { toast } from '../lib/toast.min'
import { ObjectUtil, LANGUAGESTYPE } from '../lib/util'

export type appDetailUtilType = { app_id: cyfs.ObjectId | string, app_name: string, fidArray: { fid: cyfs.ObjectId, version: string, summary: string }[], version: string, status:number, app_icon: string, owner: cyfs.ObjectId | undefined, app: cyfs.DecApp, webdir: cyfs.DirId |undefined, summary: string, auto_update: boolean, app_status: cyfs.AppLocalStatus };
export type storageAppUtilType = { id:cyfs.ObjectId|string, icon:string, name: string, tags: string[], introduce:string };

class AppOthersClass {
    m_sharedStatck: cyfs.SharedCyfsStack;
    m_util_service: cyfs.UtilRequestor;

    constructor() {
        this.m_sharedStatck = cyfs.SharedCyfsStack.open_runtime(cyfs.get_system_dec_app().object_id);
        this.m_util_service = this.m_sharedStatck.util();
    }

    async getOodStatus(id?:cyfs.ObjectId) {
        // ood status
        let req = id ? { common: { flags: 0, target: id } } : { common: { flags: 0 } };
        let ood_status = await this.m_util_service.get_ood_status(req);
        if (!ood_status.err) {
            ood_status = ood_status.unwrap().status;
            console.log('ood_status:', ood_status);
            if (ood_status.last_ping_result == 0) {
                // online
                return true;
            } else {
                // off-line
                return false;
            }
        }else{
            return false;
        }
    }

    async getHeaderInfo() {
        let headerInfo = await ObjectUtil.getHeaderInfo();
        $('.app_header_right').html(`<img class="ood_status" src="${headerInfo.oodStatusIcon}" alt=""><img class="people_head_sculpture" src="${headerInfo.peoplePicture}" alt="" onerror="this.src='./img/browser_people_icon.svg';this.οnerrοr=null"><span class="people_name">${headerInfo.peopleName}</span>`);
    }

}

export const AppOthers = new AppOthersClass;

class AppUtilClass {
    m_sharedStatck: cyfs.SharedCyfsStack;
    m_util_service: cyfs.UtilRequestor;
    m_router: cyfs.NONRequestor;

    constructor() {
        this.m_sharedStatck = cyfs.SharedCyfsStack.open_runtime(cyfs.get_system_dec_app().object_id);
        this.m_router = this.m_sharedStatck.non_service();
        this.m_util_service = this.m_sharedStatck.util();
    }

    async showApp(id: cyfs.ObjectId | string, isinstalled?: boolean) {
        if (typeof (id) == 'string') {
            let idResult = cyfs.ObjectId.from_base_58(id);
            console.origin.log('---------idResult',idResult)
            if (idResult.err) {
              toast({
                message: "Id格式不对",
                time: 1500,
                type: 'warn'
              });
              return
            } else {
                id = idResult.unwrap()
            }
        }
        let r: cyfs.DecApp;
        let ret = await ObjectUtil.getObject({ id:id, decoder:new cyfs.DecAppDecoder, flags:1 });
        if (!ret.err) {
            [r,] = ret;
        } else {
          return ret;
        }
        console.origin.log('showApp--r', r)
        if (ret.err) {
          return ret;
        } else {
            if(isinstalled){
                return ret;
            }
            let app = r;
            let appObj: { app_id: cyfs.ObjectId | string, app_name: string, app_icon: string, fidArray: { fid: cyfs.ObjectId, version: string, summary: string }[], owner: cyfs.ObjectId | undefined, app: cyfs.DecApp } = {
                app_id: id,
                app_name: '',
                app_icon: '',
                fidArray: [],
                owner: app.desc().owner()?.unwrap(),
                app: r
                };
                appObj.app_name = app.name() || '';
                appObj.app_icon = app.icon() || '../img/app/app_default_icon.svg';
                // ergodic app version list
                for (const [ver, fid] of app.source().to((k: cyfs.BuckyString) => k, (v: cyfs.ObjectId) => v)) {
                    let summaryR = app.find_source_desc(ver.value());
                    let summary = '';
                    if(!summaryR.err){
                        summary = summaryR.unwrap();
                    }
                    let app_versions: { fid: cyfs.ObjectId, version: string, summary: string } = {
                        fid: fid,
                        version: ver.value(),
                        summary: summary
                    }
                    appObj.fidArray.push(app_versions);
                }
                return appObj;
        }
    }

    async handleAppDetail (id: cyfs.ObjectId | string){
        let ret = await AppUtil.showApp(id, true);
        if (ret.err) {
            return ret;
        } else {
            let [app,] = ret;
            let get_app_status = await AppUtil.getAppStatus(id);
            console.origin.log('get_app_status', app.name(), get_app_status.version())
            let summary = '';
            if (app.body().unwrap() && app.body().unwrap().content().desc) {
                summary = app.body().unwrap().content().desc;
            }
            let appObj: appDetailUtilType = {
                app_id: id,
                app_name: '',
                app_icon: '../img/app/app_default_icon.svg',
                owner: app.desc().owner()?.unwrap(),
                app: app,
                fidArray: [],
                app_status: get_app_status,
                version: get_app_status.version(),
                status:  get_app_status.status(),
                webdir: get_app_status.webdir(),
                auto_update: get_app_status.auto_update(),
                summary: summary
            };
            appObj.app_name = app.name();
            appObj.app_icon = app.icon() || '../img/app/app_default_icon.svg';
            for (const [ver, fid] of app.source().to((k: cyfs.BuckyString) => k, (v: cyfs.ObjectId) => v)) {
                let summaryR = app.find_source_desc(ver.value());
                let summary = '';
                if(!summaryR.err){
                    summary = summaryR.unwrap();
                }
                let app_versions: { fid: cyfs.ObjectId, version: string, summary: string } = {
                    fid: fid,
                    version: ver.value(),
                    summary: summary
                }
                appObj.fidArray.push(app_versions);
            }
            return appObj;
        }
    }
    async getObjectFromRootState(path:string, owner:cyfs.ObjectId, decId:cyfs.ObjectId, decoder: cyfs.AppLocalListDecoder | cyfs.AppStatusDecoder) {
        let m_root_state = this.m_sharedStatck.root_state_access_stub(owner, decId);
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
        return obj;
    }

    async getAllAppListFun() {
        let result = await this.m_util_service.get_device({ common: { flags: 0 } });
        if (!result.err) {
          result = result.unwrap()
        }
        let current_device = result.device
        console.log('current_device: ', current_device)
        let owner = current_device.desc().owner().unwrap();
        const sysDecAppObjId = cyfs.get_system_dec_app().object_id;
        let ret = await this.getObjectFromRootState(cyfs.APP_LOCAL_LIST_PATH, owner, sysDecAppObjId, new cyfs.AppLocalListDecoder())
        console.log('ret: ', ret)

        return ret;
    }
    
    async getAppStatus(app_id) {
        if (typeof (app_id) == 'string') {
            let idRet = cyfs.ObjectId.from_base_58(app_id);
            console.log('idRet', idRet)
            if (idRet.err) {
                toast({
                message: LANGUAGESTYPE == 'zh'? 'appid错误': 'Appid error',
                time: 1500, 
                type: 'warn'
                });
                return;
            } else {
                app_id = idRet.unwrap();
            }
        }
        let result = await this.m_util_service.get_device({ common: { flags: 0 } });
        if (!result.err) {
        result = result.unwrap()
        }
        let current_device = result.device
        let owner = current_device.desc().owner().unwrap();
        const sysDecAppObjId = cyfs.get_system_dec_app().object_id;
        const path = cyfs.AppLocalStatus.get_path(app_id);
        const ret = await this.getObjectFromRootState(path, owner, sysDecAppObjId, new cyfs.AppLocalStatusDecoder())
        return ret;
    }

    async appIdFormat(id:string | cyfs.DecAppId) {
        let app_id: cyfs.DecAppId;
        if (typeof (id) == 'string') {
            let idRet = cyfs.DecAppId.from_base_58(id);
            console.log('idRet', idRet)
            if (idRet.err) {
                toast({
                message: LANGUAGESTYPE == 'zh'? 'appid错误': 'Appid error',
                time: 1500, 
                type: 'warn'
                });
                return;
            } else {
                app_id = idRet.unwrap();
            }
        }else{
            app_id = id;
        }
        return app_id;
    }
}

export const AppUtil = new AppUtilClass;


class AppDetailUtilClass {
    m_sharedStatck: cyfs.SharedCyfsStack;
    m_util_service: cyfs.UtilRequestor;
    m_router: cyfs.NONRequestor;

    constructor() {
        this.m_sharedStatck = cyfs.SharedCyfsStack.open_runtime(cyfs.get_system_dec_app().object_id);
        this.m_router = this.m_sharedStatck.non_service();
        this.m_util_service = this.m_sharedStatck.util();
    }

    async setAppAutoUpdate (id: cyfs.DecAppId | string, owner:cyfs.ObjectId, auto_update: boolean) {
        let app_id: cyfs.DecAppId | undefined = await AppUtil.appIdFormat(id);
        if(app_id){
            const appCmdObj = cyfs.AppCmd.set_auto_update(owner, app_id, auto_update);
            console.origin.log('---appCmdObj', appCmdObj)
            let postResult = await ObjectUtil.postObj(appCmdObj, cyfs.CYFS_SYSTEM_APP_CMD_VIRTUAL_PATH);
            if (postResult.err && postResult.val.code != cyfs.BuckyErrorCode.Ignored) {
                return postResult;
            }
        }
    }

    async operateApp (id: cyfs.DecAppId | string, owner:cyfs.ObjectId, operation: string) {
        let app_id: cyfs.DecAppId | undefined = await AppUtil.appIdFormat(id);
        let appCmdObj:cyfs.DecApp|cyfs.AppCmd|cyfs.AppExtInfo;
        if(app_id){
            if(operation == 'start'){
                appCmdObj = cyfs.AppCmd.start(owner, app_id);
            }else if(operation == 'stop'){
                appCmdObj = cyfs.AppCmd.stop(owner, app_id);
            }else if(operation == 'uninstall'){
                appCmdObj = cyfs.AppCmd.uninstall(owner, app_id);
            }
            console.origin.log('---appCmdObj', appCmdObj)
            let postResult = await ObjectUtil.postObj(appCmdObj!, cyfs.CYFS_SYSTEM_APP_CMD_VIRTUAL_PATH);
            if (postResult.err && postResult.val.code != cyfs.BuckyErrorCode.Ignored) {
                if(operation == 'start'){
                    toast({
                        message: LANGUAGESTYPE == 'zh'? '操作失败！': 'Operation failed',
                        time:1500,
                        type: 'warn'
                      });
                }else if(operation == 'stop'){
                    toast({
                        message: LANGUAGESTYPE == 'zh'? '操作失败！': 'Operation failed',
                        time:1500,
                        type: 'warn'
                    });
                }else if(operation == 'uninstall'){
                    toast({
                        message: LANGUAGESTYPE == 'zh'? '操作失败！': 'Operation failed',
                        time: 1500,
                        type: 'warn'
                      });
                }
                return false;
            }else{
                if(operation == 'start'){
                    toast({
                        message: LANGUAGESTYPE == 'zh'? '操作成功': 'Operation succeeded',
                        time:1500,
                        type: 'success'
                    });
                }else if(operation == 'stop'){
                    toast({
                        message: LANGUAGESTYPE == 'zh'? '操作成功': 'Operation succeeded',
                        time:1500,
                        type: 'success'
                    });
                }else if(operation == 'uninstall'){
                    toast({
                        message:LANGUAGESTYPE == 'zh'? '操作成功': 'Operation succeeded',
                        time:1500,
                        type: 'success'
                    });
                }
                return true;
            }
        }else{
            return false;
        }
    }

    async installApp (id: cyfs.DecAppId | string, owner:cyfs.ObjectId, version: string) {
        let app_id: cyfs.DecAppId | undefined = await AppUtil.appIdFormat(id);
        if(app_id){
            const appCmdObj = cyfs.AppCmd.install(owner, app_id, version, true);
            console.origin.log('--installApp-appCmdObj', appCmdObj)
            let postResult = await ObjectUtil.postObj(appCmdObj, cyfs.CYFS_SYSTEM_APP_CMD_VIRTUAL_PATH);
            if (postResult.err && postResult.val.code != cyfs.BuckyErrorCode.Ignored) {
                toast({
                    message: LANGUAGESTYPE == 'zh'? '操作失败！': 'Operation failed',
                    time:1500,
                    type: 'warn'
                });
                return false;
            }else{
                toast({
                    message: LANGUAGESTYPE == 'zh'? '操作成功': 'Operation succeeded',
                    time:1500,
                    type: 'success'
                });
                return true;
            }
        }else{
            return false;
        }
    }

    async getObjectId(url) {
        var myHeaders = new Headers();
        var myRequest = new Request(url, {
          method: 'GET',
          headers: myHeaders,
          mode: 'cors',
          cache: 'default',
        });
        fetch(myRequest).then(function (response) {
          if (response.status == 200) {
            return response.blob();
          } else {
            toast({
              message: LANGUAGESTYPE == 'zh'? '应用不存在': 'The Dec App does not exist.',
              time: 1500,
              type: 'warn'
            });
            return;
          }
        }).then(async function (myBlob) {
          return myBlob?.arrayBuffer();
        }).then(async function (buffer) {
          console.log('new Uint8Array(buffer)', url, new Uint8Array(buffer!), new Uint8Array(buffer!).toHex())
          let result = new cyfs.DecAppDecoder().raw_decode(new Uint8Array(buffer!));
          if (result.err) {
            toast({
              message: LANGUAGESTYPE == 'zh'? '操作失败！': 'Operation failed',
              time: 1500,
              type: 'warn'
            });
          } else {
            const [dec_app, rest] = result;
            console.origin.log('dec_app', dec_app, dec_app.desc().calculate_id());
            window.location.href = 'cyfs://static/DecAppStore/app_detail.html?id=' + dec_app.desc().calculate_id();
          }
        });
    };

    async addToStore(id, ownerId) {
        let app_id: cyfs.DecAppId | undefined = await AppUtil.appIdFormat(id);
        if(!app_id){
            return;
        }
        let owner_id: cyfs.ObjectId | undefined = await ObjectUtil.objectIdFormat(ownerId);
        if(!owner_id){
            return;
        }
        console.log('---owner_id', owner_id, app_id)

        const appCmdObj = cyfs.AppCmd.add(owner_id, app_id);
        console.origin.log('--addToStore-appCmdObj', appCmdObj)
        let putResult = await ObjectUtil.postObj(appCmdObj, cyfs.CYFS_SYSTEM_APP_CMD_VIRTUAL_PATH);
        console.origin.log('---putResult', putResult)
        if (putResult.err && putResult.val.code != cyfs.BuckyErrorCode.Ignored) {
          if(putResult.val.code == cyfs.BuckyErrorCode.AlreadyExists){
            // toast({
            //   message: LANGUAGESTYPE == 'zh'? 'app已经存在！': 'App already exists!',
            //   time: 1500,
            //   type: 'warn'
            // });
          }else{
            toast({
              message: LANGUAGESTYPE == 'zh'? '操作失败！': 'Operation failed',
              time: 1500,
              type: 'warn'
            });
          }
        } else {
          toast({
            message: LANGUAGESTYPE == 'zh'? '操作成功': 'Operation succeeded',
            time: 1500,
            type: 'success'
          });
        }
    }

}
export const AppDetailUtil = new AppDetailUtilClass;

export async function isBind() {
    let is_bind:boolean = false;
    $.ajax({
        url: 'http://127.0.0.1:38090/status',
        async: false,
        success:function(result){
            console.log('getStatus-result', result);
            if (result.anonymous) {
                $('.app_header_right').html(`<img class="people_head_sculpture" src="../img/browser_anonymous_icon.svg"><span class="people_name"></span>`);
            }
            if (result.is_bind) {
                AppOthers.getHeaderInfo();
            }
            is_bind = result.is_bind;
        }
    });
    return is_bind;
};
