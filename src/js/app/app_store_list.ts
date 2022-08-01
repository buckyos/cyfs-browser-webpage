import $ from 'jquery';
import * as cyfs from '../../cyfs_sdk/cyfs'
import { toast } from '../lib/toast.min'
import { ObjectUtil, formatDate, LANGUAGESTYPE } from '../lib/util'
import { isBind, AppUtil } from './app_util'

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

let g_appList:{ app_id: cyfs.ObjectId | string, app_name: string, app_icon: string, fidArray: { fid: cyfs.ObjectId, version: string }[], owner: cyfs.ObjectId | undefined, app: cyfs.DecApp }[] = [];

class AppStoreListClass {
    m_sharedStatck: cyfs.SharedCyfsStack;
    m_util_service: cyfs.UtilRequestor;
    m_router: cyfs.NONRequestor;

    constructor() {
        this.m_sharedStatck = cyfs.SharedCyfsStack.open_runtime();
        this.m_router = this.m_sharedStatck.non_service();
        this.m_util_service = this.m_sharedStatck.util();
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
            AppStoreList.addToStore(dec_app.desc().calculate_id(), dec_app.desc().owner().unwrap());
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
        let putResult = await ObjectUtil.postObj(appCmdObj);
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
          AppStoreList.getAllAppList();
          toast({
            message: LANGUAGESTYPE == 'zh'? '添加成功': 'Added successfully',
            time: 1500,
            type: 'success'
          });
        }
    }

    //app store list
    async getAllAppList(name?: string) {
        let r = await AppUtil.getAllAppListFun();
        console.origin.log('-------------r', r)
        if (r.err) {
            $('.app_list_box').html(LANGUAGESTYPE == 'zh'? '无' : 'None');
        } else {
            let storeList = r.app_list().array();
            console.origin.log('storeList', storeList)
            if (storeList && storeList.length) {
                console.log('--------------------------rstore_list', storeList)
                let storeHtml = "";
                for (let i = 0; i < storeList.length; i++) {
                    if (storeList[i]) {
                        console.log('--------------------element', i, storeList[i], storeList[i].object_id)
                        let app = await AppUtil.showApp(storeList[i].object_id, false);
                        g_appList.push(app);
                        console.log('------------------------------app', app)
                        let appBody = app.app.body().unwrap();
                        let app_introduce = LANGUAGESTYPE == 'zh'? '暂未介绍' : 'No introduction yet';
                        if (appBody.content().desc.is_some()) {
                            app_introduce = appBody.content().desc.unwrap().toString();
                        }
                        let tagsHtml = '';
                        let appExtId = await cyfs.AppExtInfo.getExtId(app.app);
                        console.log('appExtId:', appExtId);
                        let appExt = await ObjectUtil.getObject({id:appExtId, decoder:new cyfs.AppExtInfoDecoder, flags: 1});
                        console.log('appExt:', appExt);
                        if (!appExt.err) {
                          if (appExt[0]) {
                            let info = JSON.parse(appExt[0].info());
                            console.origin.log('appExt-info', app.app_name, info);
                            if (info.default && info.default['cyfs-app-store']){
                              if(info.default['cyfs-app-store'].tag){
                                  let tags = info.default['cyfs-app-store'].tag;
                                  tags.forEach(tag => {
                                    tagsHtml += `<a href="javascript:"># ${tag}</a>`;
                                  });
                              }
                            }
                          }
                        }
                        if (app.app_name.indexOf(name) > -1 || !name) {
                            storeHtml +=  `<li>
                                            <div class="app_list_info">
                                              <div class="app_list_info_l" data-id="${storeList[i].object_id}">
                                                <img src="${app.app_icon || '../img/appmanager/app_default.svg'}" onerror="this.src='../img/appmanager/app_default.svg';this.οnerrοr=null" alt="">
                                              </div>
                                              <div class="app_list_info_r">
                                                <p class="app_list_info_title" data-id="${storeList[i].object_id}">${app.app_name}</p>
                                                <p class="app_list_info_subtitle">${app_introduce}</p>
                                              </div>
                                            </div>
                                            <div class="app_list_extra_info">
                                              <div class="app_list_extra_info_l">${tagsHtml}</div>
                                              <div class="app_list_extra_info_r"></div>
                                            </div>
                                          </li>`;
                        }
                    }
                }
                $('.app_list_box').html(storeHtml);
            } else {
                $('.app_list_box').html(LANGUAGESTYPE == 'zh'? '无' : 'None');
            }
        }
    }
}

export const AppStoreList = new AppStoreListClass;
AppStoreList.getAllAppList();

// open app detail
$('.app_list_box').on('click', '.app_list_info_l, .app_list_info_title', function () {
  let id = $(this).attr('data-id');
  window.open('cyfs://static/DecAppStore/app_detail.html?id=' + id);
})

// open install app pop
$('.open_install_app_btn').on('click', function () {
    $('.app_cover_box').css('display', 'block');
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
      AppStoreList.getObjectId(txt);
      $('.app_cover_box').css('display', 'none');
      $('#cover_input').val("");
    } else {
      toast({
        message: LANGUAGESTYPE == 'zh'? '请输入正确的URL': 'Please enter the correct URL',
        time: 1500,
        type: 'warn'
      });
    }
})
