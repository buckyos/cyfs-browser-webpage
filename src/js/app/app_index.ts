import * as cyfs from '../../cyfs_sdk/cyfs'
import { toast } from '../lib/toast.min'
const Swiper = require('../lib/swiper-bundle.min')
import { ObjectUtil, LANGUAGESTYPE } from '../lib/util'

$(function(){
  if(LANGUAGESTYPE == 'zh'){
    $('title').html('应用管理');
  }else{
    $('title').html('DEC App Management');
    $('.swiper-slide-driver').html('<img src="./img/appmanager/banner_driver_en.svg">');
    $('.swiper-slide-personal').html('<img src="./img/appmanager/banner_personal_en.svg">');
  }
});

var swiper = new Swiper('.swiper-container', {
  loop: true,
  navigation: {
    nextEl: '.swiper-button-next',
    prevEl: '.swiper-button-prev',
  },
  slidesPerView: 'auto',
  spaceBetween: 92,
  centeredSlides: true,
  simulateTouch: true,
  autoplay: {
    delay: 3000,
    stopOnLastSlide: false,
    disableOnInteraction: false,
  },
  centeredSlidesBounds: false,
});

let APPLIST = [];
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

  //商店列表
  async getAllAppList(name?: string) {
    let r = await objectManager.getAllAppListFun();
    let storeListDom = document.getElementById('store_list');
    console.origin.log('-------------r', r)
    if (r.err) {
      storeListDom.innerHTML = LANGUAGESTYPE == 'zh'? '无' : 'None';
    } else {
      let storeList = r.app_list().array();
      console.origin.log('storeList', storeList)
      if (storeList && storeList.length) {
        console.log('--------------------------rstore_list', storeList)
        let storeHtml = "";
        let j = 0;
        for (let i = 0; i < storeList.length; i++) {
          if (storeList[i]) {
            console.log('--------------------element', i, storeList[i], storeList[i].object_id)
            let app = await objectManager.showApp(storeList[i].object_id, false);
            APPLIST.push(app);
            console.log('------------------------------app', app)
            let appBody = app.app.body().unwrap();
            let app_introduce = LANGUAGESTYPE == 'zh'? '暂未介绍' : 'No introduction yet';
            if (appBody.content().desc.is_some()) {
              app_introduce = appBody.content().desc.unwrap().toString();
            }
            let appImg = './img/appmanager/app_default.svg';
            if (app.app_icon) {
              appImg = app.app_icon;
            }
            if (app.app_name.indexOf(name) > -1 || !name) {
              storeHtml += `<li>
                                <img class="to_detail" data-appid="${app.app_id}" src="${appImg}">
                                <p class="half_box_title to_detail" data-appid="${app.app_id}">${app.app_name}</p>
                                <p class="half_box_detail">${app_introduce}</p>
                            </li>`;
              j++;
            }
          }
          storeListDom.innerHTML = storeHtml;
        }
      } else {
        storeListDom.innerHTML = "无";
      }
    }

  }

  async showApp(id: cyfs.ObjectId | string, isRefresh: boolean) {
    let r: cyfs.DecApp;
    let ret = await ObjectUtil.getObject({id:id, decoder:new cyfs.DecAppDecoder});
    if (ret.err) {
    } else {
      [r,] = ret;
    }
    if (isRefresh) {
      let owner = r.desc().owner().unwrap();
      let flags = isRefresh?1:0;
      let newRet = await ObjectUtil.getObject({id:id, decoder:new cyfs.DecAppDecoder,flags:flags,target:owner});
      if (newRet.err) {
        alert(LANGUAGESTYPE == 'zh'? '刷新失败': 'Refresh failed');
      } else {
        [r,] = newRet;
        let putResult = await objectManager.postObj(r);
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
          message: LANGUAGESTYPE == 'zh'? '无效url': 'Invalid URL',
          time: 1500,
          type: 'warn'
        });
        return;
      }
    }).then(async function (myBlob) {
      return myBlob.arrayBuffer();
    }).then(async function (buffer) {
      console.log('new Uint8Array(buffer)', url, new Uint8Array(buffer), new Uint8Array(buffer).toHex())
      let result = new cyfs.DecAppDecoder().raw_decode(new Uint8Array(buffer));
      if (result.err) {
        toast({
          message: LANGUAGESTYPE == 'zh'? '添加失败': 'Add failed',
          time: 1500,
          type: 'warn'
        });
      } else {
        const [dec_app, rest] = result;
        console.origin.log('dec_app', dec_app, dec_app.desc().calculate_id(), dec_app.desc().owner().unwrap())
        // let putApp = await objectManager.postObj(dec_app);
        // if (putApp.err && putApp.val.code != cyfs.BuckyErrorCode.Ignored) {
        //   toast({
        //     message: "添加失败",
        //     time: 1500,
        //     type: 'warn'
        //   });
        //   return;
        // }
        objectManager.addToStore(dec_app.desc().calculate_id(), dec_app.desc().owner().unwrap());
      }
    });
  };

  async addToStore(id, ownerId) {
    let result = await this.m_util_service.get_device({ common: { flags: 0 } });
    if (!result.err) {
      result = result.unwrap()
    }
    let current_device = result.device
    let owner = current_device.desc().owner().unwrap();
    const appCmdObj = cyfs.AppCmd.add(owner, id, ownerId);
    console.origin.log('---appCmdObj', appCmdObj)
    let putResult = await objectManager.postObj(appCmdObj);
    console.origin.log('---putResult', putResult)
    if (putResult.err && putResult.val.code != cyfs.BuckyErrorCode.Ignored) {
      if(putResult.val.code == cyfs.BuckyErrorCode.AlreadyExists){
        toast({
          message: LANGUAGESTYPE == 'zh'? 'app已经存在！': 'App already exists!',
          time: 1500,
          type: 'warn'
        });
      }else{
        toast({
          message: LANGUAGESTYPE == 'zh'? '添加失败': 'Add failed',
          time: 1500,
          type: 'warn' 
        });
      }
    } else {
      toast({
        message: LANGUAGESTYPE == 'zh'? '添加成功': 'Added successfully',
        time: 1500,
        type: 'success'
      });
    }
    objectManager.getAllAppList();
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

const objectManager = new ObjectManager();

let ANONYMOUS_STATUS:boolean;
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
            objectManager.getOodStatus();
            objectManager.getAllAppList();
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

function openCover() {
  let coverBox = document.getElementById('cover_box');
  coverBox.style.display = 'block';
}

function closeCover() {
  let coverBox = document.getElementById('cover_box');
  coverBox.style.display = 'none';
  $('#cover_input').val("");
}

async function addApp() {
  let coverInput = $('#cover_input').val().toString();
  console.log('coverInput.indexOf("cyfs://")', coverInput.indexOf("cyfs://"))
  if (coverInput.indexOf("cyfs://") == 0) {
    let txt = coverInput.replace('cyfs:/', 'http://127.0.0.1:38090');
    objectManager.getObjectId(txt);
    closeCover();
    $('#cover_input').val("");
  } else {
    toast({
      message: LANGUAGESTYPE == 'zh'? '请输入正确的URL': 'Please enter the correct URL',
      time: 1500,
      type: 'warn'
    });
  }
}

$('.add_url_btn').on('click', (event) => {
  openCover()
})

$('.close_svg_parent').on('click', ".close_svg",  function () {
  closeCover()
})

$('.cover_btn').on('click', (event) => {
  addApp()
})

$(".useing_box, .swiper-container, #store_list").on("click", ".to_detail", function () {
  let id = $(this).attr("data-appid");
  console.log('id', id);
  window.open('./app/app_detail.html?' + id);
})

$(".useing_box, .swiper-container, #store_list").on("click", ".click_app", async function () {
  let id = $(this).attr("data-appid");
  let appStatus = await objectManager.getAppStatus(id);
  if (appStatus.err) {
    toast({
      message: LANGUAGESTYPE == 'zh'? '应用正在初始化....': 'App initializing',
      time: 1500,
      type: 'warn'
    });
  } else {
    let status = appStatus;
    console.origin.log('status', status, status.status(),status.webdir())
    if (status.status() == 4 || status.status() == 5) {
      toast({
        message: LANGUAGESTYPE == 'zh'? '应用异常': 'Application exception',
        time: 1500,
        type: 'warn'
      });
    } else {
      if (status.webdir()) {
        window.open(`cyfs://a/${id}/index.html`);
      } else {
        toast({
          message: LANGUAGESTYPE == 'zh'? '应用正在初始化....': 'App initializing',
          time: 1500,
          type: 'warn'
        });
      }
    }

  }
})