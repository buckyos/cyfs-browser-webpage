import * as cyfs from '../../cyfs_sdk/cyfs'
import $ from 'jquery';
import { toast } from '../lib/toast.min'
import { ObjectUtil, LANGUAGESTYPE } from '../lib/util'

class AppOthersClass {
    m_sharedStatck: cyfs.SharedCyfsStack;
    m_util_service: cyfs.UtilRequestor;

    constructor() {
        this.m_sharedStatck = cyfs.SharedCyfsStack.open_runtime();
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
        // Device static info
        let current_device_static_info = await this.m_util_service.get_device_static_info({ common: { flags: 0 } });
        if (!current_device_static_info.err) {
            current_device_static_info = current_device_static_info.unwrap().info;
        }
        console.info('current_device_static_info:', current_device_static_info);
        let oodStatusIcon:string = '../img/browser_main_ood_offline.svg';
        let peopleName:string = '';
        let peoplePicture:string = '';
        if (current_device_static_info.owner_id) {
            const peopleR = (await ObjectUtil.getObject({ id: current_device_static_info.owner_id, isReturnResult: true, flags: 1 })).object;
            console.origin.log('peopleR:', peopleR);
            let oodList = peopleR.object.body().unwrap().content().ood_list;
            if (oodList[0]) {
                let mainStatus: boolean = await this.getOodStatus();
                console.log('--mainStatus', mainStatus)
                if(oodList.length == 1){
                    if(mainStatus){
                        oodStatusIcon = '../img/browser_main_ood_online.svg';
                    }else{
                        oodStatusIcon = '../img/browser_main_ood_offline.svg';
                    }
                }else if(oodList.length == 2){
                    let minerStatus: boolean = await this.getOodStatus(oodList[1].object_id);
                    console.log('--minerStatus', mainStatus)
                    if(mainStatus && minerStatus){
                        oodStatusIcon = '../img/browser_ood_online_online.svg';
                    }else if(mainStatus && !minerStatus){
                        oodStatusIcon = '../img/browser_ood_online_offline.svg';
                    }else if(!mainStatus && minerStatus){
                        oodStatusIcon = '../img/browser_ood_offline_online.svg';
                    }else if(!mainStatus && !minerStatus){
                        oodStatusIcon = '../img/browser_ood_offline_offline.svg';
                    }
                }
            }
            peopleName = peopleR.object.name() ? peopleR.object.name() : (LANGUAGESTYPE == 'zh'? '未设置名称':'name not set');
            if(peopleR.object.icon()){
                peoplePicture = 'cyfs://o/'+peopleR.object.icon().object_id;
            }else{
                peoplePicture = '../img/browser_people_icon.svg';
            }
        }
        $('.app_header_right').html(`<img class="ood_status" src="${oodStatusIcon}" alt=""><img class="people_head_sculpture" src="${peoplePicture}" alt="" onerror="this.src='../img/browser_people_icon.svg';this.οnerrοr=null"><span class="people_name">${peopleName}</span>`);
    }

}

export const AppOthers = new AppOthersClass;

class AppUtilClass {
    m_sharedStatck: cyfs.SharedCyfsStack;
    m_util_service: cyfs.UtilRequestor;
    m_router: cyfs.NONRequestor;

    constructor() {
        this.m_sharedStatck = cyfs.SharedCyfsStack.open_runtime();
        this.m_router = this.m_sharedStatck.non_service();
        this.m_util_service = this.m_sharedStatck.util();
    }

    async showApp(id: cyfs.ObjectId | string, isRefresh: boolean) {
        if (typeof (id) == 'string') {
            let idResult = cyfs.ObjectId.from_base_58(id);
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
        let ret = await ObjectUtil.getObject({id:id, decoder:new cyfs.DecAppDecoder});
        if (!ret.err) {
            [r,] = ret;
        } else {
          return;
        }
        if (isRefresh) {
          let owner = r.desc().owner()?.unwrap();
          let flags = isRefresh?1:0;
          let newRet = await ObjectUtil.getObject({id:id, decoder:new cyfs.DecAppDecoder,flags:flags,target:owner});
          if (newRet.err) {
            alert(LANGUAGESTYPE == 'zh'? '刷新失败': 'Refresh failed');
          } else {
            [r,] = newRet;
            let putResult = await ObjectUtil.postObj(r);
            if (putResult.err && putResult.val.code != cyfs.BuckyErrorCode.Ignored) {
              alert(LANGUAGESTYPE == 'zh'? '刷新失败': 'Refresh failed');
            }
          }
        }
        console.origin.log('showApp--r', r)
        if (ret.err) {
          return ret;
        } else {
          let app = r;
          let appObj: { app_id: cyfs.ObjectId | string, app_name: string, app_icon: string, fidArray: { fid: cyfs.ObjectId, version: string }[], owner: cyfs.ObjectId | undefined, app: cyfs.DecApp } = {
            app_id: id,
            app_name: '',
            app_icon: '',
            fidArray: [],
            owner: app.desc().owner()?.unwrap(),
            app: r
          };
          appObj.app_name = app.name() || '';
          appObj.app_icon = app.icon() || '';
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

    async getObjectFromRootState(path, owner, decId, decoder) {
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
        console.origin.log('retDecoder-ret', obj);
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

}

export const AppUtil = new AppUtilClass;

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
