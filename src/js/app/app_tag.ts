import $ from 'jquery';
import * as cyfs from '../../cyfs_sdk/cyfs'
import { toast } from '../lib/toast.min'
import { ObjectUtil, formatDate, LANGUAGESTYPE } from '../lib/util'
import { isBind, AppUtil, AppDetailUtil } from './app_util'

let g_isBind:boolean;
let g_tag:string = '';
let g_appList:{ app:{ app_id: cyfs.ObjectId | string, app_name: string, app_icon: string, fidArray: { fid: cyfs.ObjectId, version: string }[], owner: cyfs.ObjectId | undefined, app: cyfs.DecApp }, tags?:  string[] }[] = [];

$(async function(){
    if(LANGUAGESTYPE == 'zh'){
        $('title').html('标签');
    }else{
        $('title').html('Tag');
    }
    let g_isBind = await isBind();
    if(!g_isBind){
        window.location.href = 'cyfs://static/browser.html';
    }
});

if (window.location.search.split("?")[1]) {
    let str = window.location.search.split("?")[1];
    if (str.indexOf('=') > -1 && str.split('=')[1] && str.split('=')[0] == 'tag') {
        g_tag = decodeURI(str.split('=')[1]);
    }else{
        g_tag = decodeURI(str);
    }
    
    $('.app_content_title').html(LANGUAGESTYPE == 'zh' ? `应用列表 - 标签(#${g_tag})` : `Dec App List - Tag(#${g_tag})`);
}
console.log('----g_tag', g_tag);

class AppListClass {
    m_sharedStatck: cyfs.SharedCyfsStack;
    m_util_service: cyfs.UtilRequestor;
    m_router: cyfs.NONRequestor;

    constructor() {
        this.m_sharedStatck = cyfs.SharedCyfsStack.open_runtime();
        this.m_router = this.m_sharedStatck.non_service();
        this.m_util_service = this.m_sharedStatck.util();
    }

    async getAllAppList() {
        let r = await AppUtil.getAllAppListFun();
        console.origin.log('-------------r', r)
        if (r.err) {
            $('.app_tag_list').html(LANGUAGESTYPE == 'zh'? '无' : 'None');
        } else {
            let storeList = r.app_list().array();
            if (storeList && storeList.length) {
                for (let i = 0; i < storeList.length; i++) {
                    let app = await AppUtil.showApp(storeList[i].object_id, false);
                    let appExtId = await cyfs.AppExtInfo.getExtId(app.app);
                    console.log('appExtId:', appExtId);
                    let appExt = await ObjectUtil.getObject({id:appExtId, decoder:new cyfs.AppExtInfoDecoder, flags: 1});
                    console.log('appExt:', appExt);
                    if (!appExt.err) {
                        if (appExt[0]) {
                          let info = JSON.parse(appExt[0].info());
                          console.origin.log('appExt-info', app.app_name, info);
                          if (info && info['cyfs-app-store']){
                            if(info['cyfs-app-store'].tag){
                                let tags = info['cyfs-app-store'].tag;
                                if(tags.indexOf(g_tag) > -1){
                                    g_appList.push({ app:app, tags: tags });
                                }
                                
                            }
                          }
                        }
                    }
                }
                g_appList = await g_appList.sort(AppList.sortNumber);
            }
            console.origin.log('------g_appList', g_appList);
            $('.app_tag_list').html('');
            let liHtml:string = '';
            for (let i = 0; i < g_appList.length; i++) {
                let app = g_appList[i].app;
                let app_introduce = LANGUAGESTYPE == 'zh'? '暂未介绍' : 'No introduction yet';
                if (app.app.body().unwrap().content().desc.is_some()) {
                    app_introduce = app.app.body().unwrap().content().desc.unwrap().toString();
                }
                let tagsHtml:string = '';
                g_appList[i].tags?.forEach(tag => {
                    tagsHtml += `<a href="cyfs://static/DecAppStore/app_tag.html?tag=${tag}"># ${tag}</a>`;
                });
                liHtml = `<li>
                            <div class="app_tag_img_box float_l">
                                <img src="${app.app_icon || '../img/app/app_default_icon.svg'}" alt="" onerror="this.src='./img/app/app_default_icon.svg';this.οnerrοr=null">
                            </div>
                            <div class="float_l">
                                <p class="app_tag_title">${app.app_name}</p>
                                <p class="app_tag_info">${app_introduce}</p>
                                <p class="app_tag_p">
                                    ${tagsHtml}
                                </p>
                            </div>
                        </li>`;
                $('.app_tag_list').append(liHtml);
            }
        }
    }

    sortNumber(a,b){
        return b.app.app.body().unwrap().update_time() - a.app.app.body().unwrap().update_time();
    }

}

export const AppList = new AppListClass;
AppList.getAllAppList();

// open install app pop
$('.open_install_app_btn').on('click', function () {
    $('.app_cover_box .app_cover_input').val('');
    $('.app_cover_box').css('display', 'block');
})

// close install app pop
$('.app_cover_box').on('click', '.app_cover_close_i', function () {
    $('.app_cover_box').css('display', 'none');
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

$('.app_upload_btn').on('click', function () {
    window.location.href = "cyfs://static/DecAppStore/upload_dec_app.html";
})

$('.app_header_box').on('click', '.people_head_sculpture', function () {
    window.location.href = 'cyfs://static/info.html';
})
