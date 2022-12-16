import { each } from 'jquery';
import * as cyfs from '../../cyfs_sdk/cyfs'
import { toast } from '../lib/toast.min'
const Swiper = require('../lib/swiper-bundle.min')
import { ObjectUtil, formatDate, LANGUAGESTYPE } from '../lib/util'

$(function(){
  if(LANGUAGESTYPE == 'zh'){
    $('title').html('应用详情');
  }else{
    $('title').html('DEC App Management');
  }
});

let VERSION_ID = '';
let APP_INTRODUCE = '';
let VERSION_INSTALLED = '';
let STATUS_INSTALLED:number;
let APP_OWNER: cyfs.ObjectId;

class ObjectManager {
  m_sharedStatck: cyfs.SharedCyfsStack;
  m_util_service: cyfs.UtilRequestor;
  m_router: cyfs.NONRequestor;
  constructor() {
    this.m_sharedStatck = cyfs.SharedCyfsStack.open_runtime(cyfs.get_system_dec_app().object_id);
    this.m_router = this.m_sharedStatck.non_service();
    this.m_util_service = this.m_sharedStatck.util();
  }

  async showApp(id: cyfs.ObjectId | string, isRefresh: boolean) {
    let r: cyfs.DecApp;
    let ret = await ObjectUtil.getObject({id:id, decoder:new cyfs.DecAppDecoder});

    if (ret.err) {
      alert(LANGUAGESTYPE == 'zh'? '失败': 'fail');
    } else {
      [r,] = ret;
    }
    if (isRefresh) {
      let owner = r.desc().owner().unwrap();
      let newRet = await ObjectUtil.getObject({id:id, decoder: cyfs.DecAppDecoder.create(), target:owner, flags:cyfs.CYFS_ROUTER_REQUEST_FLAG_FLUSH});
      if (newRet.err) {
        alert(LANGUAGESTYPE == 'zh'? '刷新失败': 'Refresh failed');
      } else {
        [r,] = newRet;
        let putResult = await objectManager.putObj(r);
        if (putResult.err && putResult.val.code != cyfs.BuckyErrorCode.Ignored) {
          alert(LANGUAGESTYPE == 'zh'? '刷新失败': 'Refresh failed');
        }
      }
    }

    if (ret.err) {
      console.log('showApp--r', r)
      return ret;
    } else {
      let app = r;
      let appObj: { app_id: cyfs.ObjectId | string, app_name: string, app_icon: string, fidArray: { fid: cyfs.ObjectId, version: string }[], owner: cyfs.ObjectId, app: cyfs.DecApp } = {
        app_id: id,
        app_name: '',
        app_icon: '',
        fidArray: [],
        owner: app.desc().owner().unwrap(),
        app: r
      };
      // 取app的名字和图标，icon可能为undefined
      appObj.app_name = app.name();
      appObj.app_icon = app.icon();
      // 遍历app的版本列表
      for (const [ver, fid] of app.source().to((k: cyfs.BuckyString) => k, (v: cyfs.ObjectId) => v)) {
        let app_versions: { fid: cyfs.ObjectId, version: string } = {
          fid: fid,
          version: ver.value()
        }
        appObj.fidArray.push(app_versions);
      }
      return appObj;
    }

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

  async installAllFun(id: string, ver: string, status: boolean) {
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
    console.log('id, ver, status:', id, ver, status)
    let result = await this.m_util_service.get_device({ common: { flags: 0 } });
    if (!result.err) {
      result = result.unwrap()
    }
    let current_device = result.device
    console.log('current_device: ', current_device)
    let owner = current_device.desc().owner().unwrap();

    const appCmdObj = cyfs.AppCmd.install(owner, idObj, ver, true );
    
    let r = await this.postObj(appCmdObj);
    console.origin.log('安装：', r);
    this.getAppStatus(idObj);
    if (r.err && r.val.code != cyfs.BuckyErrorCode.Ignored) {
      console.origin.log('r.val.code：', r.val.code);
      console.log('r.val.code', r.val.code);
      $('.install_btn').attr('disabled', '');
      $('.install_btn').attr('value', LANGUAGESTYPE == 'zh'?'安装': 'Install');
      if(r.val.code == cyfs.BuckyErrorCode.ErrorState){
        alert(LANGUAGESTYPE == 'zh'? '安装失败' : 'Install Failed');
      }
      return r;
    } else {
      $('.install_btn').attr('disabled', 'disabled');
      $('.install_btn').attr('value', LANGUAGESTYPE == 'zh'?'已安装': 'Installed');
      VERSION_INSTALLED = ver;
    }
  }

  async postObj(obj) {
    const router = this.m_router;
    let buf_len = obj.raw_measure().unwrap();
    let buf = new Uint8Array(buf_len);
    obj.raw_encode(buf);
    let r = await router.post_object({
      object: new cyfs.NONObjectInfo(obj.desc().calculate_id(), buf),
      common: {
        level: cyfs.NONAPILevel.Router,
        flags: 0,
        req_path: null
      }
    });
    console.origin.log('--------r', r)
    if (r.err && r.val.code != cyfs.BuckyErrorCode.Ignored) {
      return r;
    } else {
      return r;
    }
  }

  async getObjectFromRootState(path, owner, decId, decoder) {
    console.origin.log('path, owner, decId, decoder', path, owner, decId, decoder);

    let m_root_state = this.m_sharedStatck.root_state_access_stub(owner, decId);
    const ret = await m_root_state.get_object_by_path(path);
    if (ret.err) {
      console.log('getAppStatus-ret-err', ret);
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

  async getAppStatus(app_id) {
    let result = await this.m_util_service.get_device({ common: { flags: 0 } });
    if (!result.err) {
      result = result.unwrap()
    }
    let current_device = result.device
    console.log('current_device: ', current_device)
    let owner = current_device.desc().owner().unwrap();

    let object_id: cyfs.DecAppId;
    if (typeof (app_id) == 'string') {
      let idResult = cyfs.DecAppId.from_base_58(app_id);
      if (idResult.err) {
        toast({
          message: LANGUAGESTYPE == 'zh'? 'Id格式不对': 'wrong ID format',
          time: 1500,
          type: 'warn'
        });
        return
      } else {
        object_id = idResult.unwrap();
      }
    } else {
      object_id = app_id;
    }
    const sysDecAppObjId = cyfs.get_system_dec_app().object_id;
    const path = cyfs.AppLocalStatus.get_path(object_id);
    const ret = await this.getObjectFromRootState(path, owner, sysDecAppObjId, new cyfs.AppLocalStatusDecoder());
    if (ret.err) {
      console.origin.log('getAppStatus-ret-err', ret);
      return ret;
    }
    console.origin.log('getAppStatus-ret', VERSION_ID, ret.version(), ret.status());
    VERSION_INSTALLED = ret.version();
    STATUS_INSTALLED = ret.status();
    if(VERSION_ID != VERSION_INSTALLED || ret.status() == cyfs.AppLocalStatusCode.Init || ret.status() == cyfs.AppLocalStatusCode.InstallFailed || ret.status() == cyfs.AppLocalStatusCode.Uninstalled){
      $('.install_btn').removeAttr("disabled");
      $('.install_btn').attr('value', LANGUAGESTYPE == 'zh'?'安装': 'Install');
    }else{
      $('.install_btn').attr('disabled', 'disabled')
      $('.install_btn').attr('value', LANGUAGESTYPE == 'zh'?'已安装': 'Installed');
    }
  }

  async initData(id) {
    let app = await objectManager.showApp(id, true);
    console.origin.log('---------app:', app);
    $('.app_title').html(app.app_name);
    let appVersions = '';
    if (app.fidArray.length > 0) {
      app.fidArray.forEach(element => {
        appVersions += `<li data-version="${element.version}" data-status="${element.status}">${element.version}</li>`;
      });
      VERSION_ID = app.fidArray[app.fidArray.length - 1].version;
      $('.version_show').html(VERSION_ID);
      $('.edition_info').html(VERSION_ID);
    };
    $('.cross_box_ul').html(appVersions);
    if (app.app_icon) {
      $('.app_detail_img').attr('src', app.app_icon);
    }
    console.log('app.app:', app.app);
    let owner = null;
    if (app.app.desc().owner) {
      owner = APP_OWNER = app.app.desc().owner().unwrap();
      $('.owner_info').html(`<span>${LANGUAGESTYPE == 'zh'?'开&nbsp; 发 者：': 'Developer：'}</span>${owner}`)
    }
    if(app.app.desc().dec_id()){
      let decid = app.app.desc().dec_id().unwrap();
      $('.decid_info').html(`<span>Dec-ID：</span>${decid}`)
    }
    objectManager.getAppStatus(id);
    console.log('APP_OWNER, id:', APP_OWNER, id);
    let appBody = app.app.body().unwrap();
    $('.time_info').html(`<span>${LANGUAGESTYPE == 'zh'?'发布时间：': 'Released time：'}</span>${await formatDate(cyfs.bucky_time_2_js_time(appBody.update_time()))}`);
    if (appBody.content().desc) {
      APP_INTRODUCE = appBody.content().desc.unwrap().toString();
      $('.app_introduce').html(`<p>${APP_INTRODUCE}</p>`);
    } else {
      $('.app_introduce').html(`<p>${LANGUAGESTYPE == 'zh'?'暂未介绍': 'No introduction yet'}</p>`);
    }
    let appExtId = await cyfs.AppExtInfo.getExtId(app.app);
    console.log('appExtId:', appExtId);
    let flag = owner ? 1 : 0;
    let appExt = await ObjectUtil.getObject({id:appExtId, decoder:new cyfs.AppExtInfoDecoder, flags: flag,target:owner});
    console.log('appExt:', appExt);
    if (appExt.err) {
      $('.detail_img_box').css('display', 'none');
    } else {
      if (appExt[0]) {
        let info = JSON.parse(appExt[0].info());
        console.log('info', info);
        if (info.default && info.default.medias && info.default.medias.list) {
          let imgSrc = '';
          info.default.medias.list.forEach(media => {
            imgSrc += `<div class="swiper-slide"><img src="${media}"></div>`
          })
          $('.swiper-wrapper').html(imgSrc);
          var swiper = new Swiper('.swiper-container', {
            loop: false,
            slidesPerView: 'auto',
            spaceBetween: 21,
            simulateTouch: true,
            centeredSlidesBounds: false,
          });
        } else {
          $('.detail_img_box').css('display', 'none');
        }
      }
    }
  }
}

const objectManager = new ObjectManager();

let ANONYMOUS_STATUS:boolean;
let APP_ID:string;
$.ajax({
    url: 'http://127.0.0.1:38090/status',
    success:function(result){
        console.log('getStatus-result', result);
        ANONYMOUS_STATUS = result.anonymous;
        if(result.anonymous){
            $('.anonymous_box').css('display', 'block');
            $('.app_box').css('display', 'none');
        }else{
          if (result.is_bind) {
            let appId = APP_ID = window.location.search.split("?")[1];
            console.log('appId:', appId);
            objectManager.initData(appId);
            setInterval(async () => {
              objectManager.getAppStatus(appId);
            }, 10 * 1000);
          }
        }
    }
});

$('.anonymous_subtitle').on('click', async function () {
  window.open('cyfs://static/guide.html');
})

$(".cross_box_ul").on("click", "li", async function () {
  let version = $(this).attr("data-version");
  console.log('version:', version, VERSION_INSTALLED);
  VERSION_ID = version;
  $('.version_show').html(version);
  if(VERSION_INSTALLED != version || STATUS_INSTALLED == cyfs.AppLocalStatusCode.Init || STATUS_INSTALLED == cyfs.AppLocalStatusCode.InstallFailed || STATUS_INSTALLED == cyfs.AppLocalStatusCode.Uninstalled){
    $('.install_btn').removeAttr("disabled");
    $('.install_btn').attr('value', LANGUAGESTYPE == 'zh'?'安装': 'Install');
  }else{
    $('.install_btn').attr('disabled', 'disabled')
      $('.install_btn').attr('value', LANGUAGESTYPE == 'zh'?'已安装': 'Installed');
  }
  $(".cross_box_ul").css('display', "none");
})

$(".cross_box").on("click", function () {
  if ($(".cross_box_ul").css('display') == 'block') {
    $(".cross_box_ul").css('display', "none");
  } else {
    $(".cross_box_ul").css('display', "block");
  }

})

$(".install_btn").on("click", function () {
  let version = $('.version_show').text();
  console.log('APP_ID, version',APP_ID, version)
  $('.install_btn').attr('disabled', 'disabled');
  $('.install_btn').attr('value', LANGUAGESTYPE == 'zh'?'正在安装': 'Installing');
  objectManager.installAllFun(APP_ID, version, true);
})
