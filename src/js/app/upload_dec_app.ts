import $ from 'jquery';
import * as cyfs from '../../cyfs_sdk/cyfs'
import { toast } from '../lib/toast.min'
import { ObjectUtil, formatDate, LANGUAGESTYPE, lenghtstr, copyData } from '../lib/util'
import { isBind, AppUtil } from './app_util'
let QRCode = require('qrcode')

let g_isBind:boolean;
let g_owner: cyfs.ObjectId;
let g_app: { app_id: cyfs.ObjectId | string, app_name: string, app_icon: string, fidArray: { fid: cyfs.ObjectId, version: string, summary: string }[], owner: cyfs.ObjectId | undefined, app: cyfs.DecApp };
let g_appId:string = '';
let g_appExtInfo:cyfs.AppExtInfo;
let g_appExtId:string = '';
let g_isEdit:boolean = false;

if (window.location.search.split("?")[1]) {
    let str = window.location.search.split("?")[1];
    let arr = str.split('&');
    if (arr) {
        for (let i = 0; i < arr.length; i++) {
            if (arr[i].indexOf('=') > -1 && arr[i].split('=')[1] && arr[i].split('=')[0] == 'id') {
                g_isEdit = true;
                g_appId = arr[i].split('=')[1];
            }
        }
    }
}
console.log('---------g_appId:', g_appId);

$(async function(){
    if(g_isEdit){
        $('title, .app_content_title').html(LANGUAGESTYPE == 'zh'?'编辑应用':'Edit Dec App');
        $('.app_subtitle_box').css('display', 'block');
        $('.upload_app_box').css('display', 'none');
        UploadApp.getAppInfo(g_appId);
    }else{
        $('title, .app_content_title').html(LANGUAGESTYPE == 'zh'?'上传应用':'Upload Dec App');
        $('.upload_app_box').css('display', 'block');
        $('.app_subtitle_box').css('display', 'none');
    }
    let g_isBind = await isBind();
    if(!g_isBind){
        window.location.href = 'cyfs://static/guide.html';
    }
});

class UploadAppClass {
    m_sharedStatck: cyfs.SharedCyfsStack;
    m_util_service: cyfs.UtilRequestor;
    m_router: cyfs.NONRequestor;
    meta_client: cyfs.MetaClient;

    constructor() {
        this.m_sharedStatck = cyfs.SharedCyfsStack.open_runtime(cyfs.get_system_dec_app().object_id);
        this.m_router = this.m_sharedStatck.non_service();
        this.m_util_service = this.m_sharedStatck.util();
        this.meta_client = cyfs.create_meta_client();
    }

    async getOwner () {
        let result = await this.m_util_service.get_device({ common: { flags: 0 } });
        if (!result.err) {
          result = result.unwrap()
        }
        let current_device = result.device
        g_owner = current_device.desc().owner().unwrap();
    }

    async getObjectId(url) {
        if(!g_owner){
            await UploadApp.getOwner();
        }
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
              message: LANGUAGESTYPE == 'zh'? '输入的URL错误': 'URL entered incorrectly.',
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
                message: LANGUAGESTYPE == 'zh'? '输入的URL错误': 'URL entered incorrectly.',
                time: 1500,
                type: 'warn'
            });
          } else {
            const [dec_app, rest] = result;
            console.log('dec_app', dec_app.desc().calculate_id(), dec_app.desc().owner().unwrap(), g_owner);
            g_appId =  dec_app.desc().calculate_id().toString();
            if(dec_app.desc().owner().unwrap().toString() == g_owner.toString()){
                UploadApp.getAppInfo(dec_app.desc().calculate_id())
            }else{
                toast({
                    message: LANGUAGESTYPE == 'zh'? '输入的URL错误': 'URL entered incorrectly.',
                    time: 1500,
                    type: 'warn'
                });
            }
          }
        });
    };

    async getAppInfo (appId: string | cyfs.ObjectId) {
        let app = g_app = await AppUtil.showApp(appId, false);
        console.origin.log('--------------app:', app);
        if(app.err){
            toast({
                message: LANGUAGESTYPE == 'zh'? '输入的URL错误': 'URL entered incorrectly.',
                time: 1500,
                type: 'warn'
            });
            return;
        }
        if(g_isEdit){
            if(!g_owner){
                await UploadApp.getOwner();
            }
            if(g_app.app.desc().owner()?.toString() != g_owner.toString()){
                toast({
                    message: LANGUAGESTYPE == 'zh'? '输入的URL错误': 'URL entered incorrectly.',
                    time: 1500,
                    type: 'warn'
                });
                return;
            }
        }
        $('.upload_app_info_container').css('display', 'block');
        $('.upload_app_info_dec_id').html(g_appId);
        $('.upload_app_info_id_copy').attr('data-id', g_appId);
        $('.upload_app_info_name').val(app.app_name);
        if (app.app.body().unwrap().content().desc) {
            $('.upload_app_overview_txt').val(app.app.body().unwrap().content().desc.unwrap().toString());
        }
        if (app.app_icon) {
            $('.upload_app_icon_img').attr('img', '../img/app/app_default_icon.svg');
        }
        let appExtId = await cyfs.AppExtInfo.getExtId(app.app);
        g_appExtId = appExtId.toString();
        console.log('appExtId:', appExtId);
        let appExt = await ObjectUtil.getObject({id:appExtId, decoder:new cyfs.AppExtInfoDecoder, flags: 1});
        console.origin.log('appExt:', appExt); 
        if (!appExt.err) {
            if (appExt[0]) {
                g_appExtInfo = appExt[0];
                let info = JSON.parse(appExt[0].info());
                console.origin.log('appExt-info', info);
                if (info && info['cyfs-app-store']){
                    if(info['cyfs-app-store'].tag){
                        let tags = info['cyfs-app-store'].tag;
                        let html = '';
                        tags.forEach(tag => {
                            html += `<li class="upload_app_tag_checked" data-check="checked">
                                        <input type="text" name="" id="" disabled value="${tag}">
                                    </li>`;
                        });
                        $('.upload_app_tag_ul').html(html);
                        if(info['cyfs-app-store'].client){
                            let clients = info['cyfs-app-store'].client;
                            if(clients.android){
                                $('.app_software_android').val(clients.android);
                            }
                            if(clients.iOS){
                                $('.app_software_ios').val(clients.iOS);
                            }
                            if(clients.windows){
                                $('.app_software_windows').val(clients.windows);
                            }
                            if(clients.macOS){
                                $('.app_software_macos').val(clients.macOS);
                            }
                            if(clients.linux){
                                $('.app_software_linux').val(clients.linux);
                            }
                            if(clients.other){
                                $('.app_software_other').val(clients.other);
                            }
                        }
                        if(info['cyfs-app-store'].community){
                            let communitys = info['cyfs-app-store'].community;
                            communitys
                            for (let index = 0; index < communitys.length; index++) {
                                const community = communitys[index];
                                for (const key in community) {
                                    if(key == 'CyberChat'){
                                        $('.community_select_cyber').val(community[key]);
                                    }else if(key == 'Discord'){
                                        $('.community_select_discord').val(community[key]);
                                    }else if(key == 'Twitter'){
                                        $('.community_select_twitter').val(community[key]);
                                    }else if(key == 'GitHub'){
                                        $('.community_select_gitbub').val(community[key]);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

}

export const UploadApp = new UploadAppClass;
UploadApp.getOwner();

$('.get_app_info_btn').on('click', function () {
    let coverInput:string = $('.get_app_input').val()?.toString() || '';
    if(!coverInput){
        return;
    }
    if (coverInput.indexOf("cyfs://") == 0) {
        let txt = coverInput.replace('cyfs:/', 'http://127.0.0.1:38090');
        UploadApp.getObjectId(txt);
    }else{
        toast({
            message: LANGUAGESTYPE == 'zh'? '输入的URL错误': 'URL entered incorrectly.',
            time: 1500,
            type: 'warn'
        });
    }
})

$('.upload_app_tag_ul').on('click', 'li', function () {
    let check:string = $(this).attr('data-check') || 'uncheck';
    if(check == 'checked'){
        $(this).attr('data-check', 'uncheck');
        $(this).removeClass('upload_app_tag_checked upload_app_tag_uncheck').addClass('upload_app_tag_uncheck');
    }else{
        $(this).attr('data-check', 'checked');
        $(this).removeClass('upload_app_tag_checked upload_app_tag_uncheck').addClass('upload_app_tag_checked');
    }
})

$('.upload_app_tag_btn').on('click', function () {
    $('.upload_app_tag_ul').append(`<li class="upload_app_tag_uncheck" data-check="uncheck">
                                        <input type="text" name="" id="" value="">
                                    </li>`);
})

$('.upload_app_tag_ul').on('blur', 'input', function () {
    $(this).attr('disabled', 'disable');
})

// $('.upload_app_community_btn').on('click', function () {
//     let communityHtml:string = '';
//     communityHtml = `<li class="overflow_h upload_app_info_li">
//                         <div class="float_l upload_app_info_label"></div>
//                         <div class="float_l upload_app_info_input">
//                         <div class="upload_app_info_select">
//                             <select name="upload_app_community_select" id="">
//                                 <option value="Cyber Chat">Cyber Chat</option>
//                                 <option value="Discord">Discord</option>
//                                 <option value="Twitter">Twitter</option>
//                                 <option value="GitHub">GitHub</option>
//                             </select>
//                             <i class="upload_app_info_select_i"></i>
//                         </div>
//                         <input class="upload_app_info_select_ipt" type="text" name="" id="" placeholder="cyfs://……..">
//                         </div>
//                         <div class="float_l">
//                         </div>
//                     </li>`;
//     $('.upload_app_info_ul').append(communityHtml);
// })

// $('.app_client_install_btn').on('click', function () {
//     let communityHtml:string = '';
//     communityHtml = `<li>
//                         <div class="upload_app_info_select">
//                         <select name="" id="">
//                             <option value="IOS">IOS</option>
//                             <option value="Android">Android</option>
//                             <option value="Windows">Windows</option>
//                             <option value="MacOS">MacOS</option>
//                             <option value="Linux">Linux</option>
//                             <option value="Other">Other</option>
//                         </select>
//                         <i class="upload_app_info_select_i"></i>
//                         </div>
//                         <input class="" type="text" name="" id="" placeholder="https://www.apple.com/app-store/,,,">
//                     </li>`;
//     $('.upload_app_client_ul').append(communityHtml);
// })

$('.open_tip_btn').on('click', function () {
    window.open('cyfs://static/DecAppStore/app_like_tip_list.html?id=' + g_appId);
})

$(".radio_type").on("click",function(){
    var val = $(this).val();
    if (val=='0') {
        $('.upload_app_client_box').css('display', 'block');
    } else {
        $('.upload_app_client_box').css('display', 'none');
    }
});

$(".app_info_submit_btn").on("click", async function(){
    // return;
    let name:string = JSON.stringify($('.upload_app_info_name').val()).trim() || '';
    let nameLength = lenghtstr(name);
    console.log('nameLength', nameLength);
    if(nameLength < 5 || nameLength > 100){
        toast({
            message: LANGUAGESTYPE == 'zh'? 'Dec APP名称包含至少5个字符，不超过100个字符，并且没有特殊字符和标点符号。': 'Dec app name contains at least 5 characters and no more than 100 characters and no special characters and punctuation.',
            time: 1500,
            type: 'warn'
          });
        return;
    }
    let overview:string = JSON.stringify($('#upload_app_overview_txt').val()).trim() || '';
    let overviewLength = lenghtstr(overview);
    console.log('overviewLength', overviewLength);
    if(overviewLength < 20 || overviewLength > 500){
        toast({
            message: LANGUAGESTYPE == 'zh'? '概述不少于20个字符，不超过500个字符。': 'Overview no less than 20 characters and no more than 500 characters.',
            time: 1500,
            type: 'warn'
          });
        return;
    }
    let tags: string[] = [];
    let tag: string = '';
    let tagLength: number = 0;
    let isComplianceTag:boolean = false;
    $.each($('.upload_app_tag_ul li'), function(index, value) {
        if($(this).attr('data-check') == 'checked'){
            tag = JSON.stringify($(this).find('input').val()).trim();
            tagLength = lenghtstr(tag);
            if(tagLength < 2 || tagLength > 20){
                isComplianceTag = true;
            }
            tags.push(tag);
        }
    });
    console.origin.log('tags: ', tags);
    if(isComplianceTag){
        toast({
            message: LANGUAGESTYPE == 'zh'? '标记包含至少5个字符，不超过100个字符，并且没有特殊字符和标点符号。': 'Tag contains at least 5 characters and no more than 100 characters and no special characters and punctuation.',
            time: 1500,
            type: 'warn'
          });
        return;
    }
    let communitys:string[] = [];
    let communityStr:string = '[';
    let communityDoms = $('select[name="upload_app_community_select"]');
    $.each(communityDoms, function(index, value) {
        let communityTxt = JSON.stringify($(this).parent('.upload_app_info_select').siblings('.upload_app_info_select_ipt').val()).trim() || '';
        let community = JSON.stringify($(this).val()).trim();
        communitys.push(community);
        communityStr += `{${community}: [${communityTxt}]}`;
        if(index <  communityDoms.length - 1){
            communityStr += ',';
        }
    });
    communityStr += ']';
    console.origin.log('communityStr: ', communityStr);
    let softwareStr:string = '{';
    if($('.radio_type:checked').val() == '0'){
        let softwareDoms = $('select[name="client_software_select"]');
        $.each(softwareDoms, function(index, value) {
            let softwareTxt = JSON.stringify($(this).parent('.upload_app_info_select').siblings('.client_software_ipt').val()).trim() || '';
            let software = JSON.stringify($(this).val()).trim();
            console.origin.log('community: ', software, softwareTxt);
            softwareStr += `${software}: ${softwareTxt}`;
            if(index <  softwareDoms.length - 1){
                softwareStr += ',';
            }
        });
        console.origin.log('softwareStr: ', softwareStr, );
    }
    softwareStr += '}';
    let releasedate;
    if(g_appExtInfo.info()){
        let info = JSON.parse(g_appExtInfo.info());
        if(info.releasedate){
            releasedate = info.releasedate;
        }
    }
    let extInfo ={
        "cyfs-app-store": {
            "tag": tags,
            "client": JSON.parse(softwareStr),
            "community": JSON.parse(communityStr),
            "releasedate": releasedate || {}
        }
    }
    console.origin.log('extInfo: ', extInfo);
    g_appExtInfo.set_info(JSON.stringify(extInfo));
    g_app.app.set_app_desc(overview);
    let putAppR = await ObjectUtil.putObj(g_app.app);
    if(putAppR.err){
        toast({
            message: LANGUAGESTYPE == 'zh'? '上传APP失败。': 'post APP failed',
            time: 1500,
            type: 'warn'
        });
        return;
    }
    let putExtR = await ObjectUtil.putObj(g_appExtInfo);
    if(putExtR.err){
        toast({
            message: LANGUAGESTYPE == 'zh'? '上传APP失败。': 'post APP failed',
            time: 1500,
            type: 'warn'
        });
        return;
    }
    $('#app_tip_scan_box').html('');
    $('.app_cover_box').css('display', 'block');
    let data = { "flag": "cyfs", "type": "updateMeta", "data": { "id": [g_appId, g_appExtId] } }
    QRCode.toCanvas(document.getElementById('app_tip_scan_box'), JSON.stringify(data), {
        errorCorrectionLevel: 'L',
        width: 84,
        height: 84,
        margin: 0
    });
});
 
$('.app_cover_box').on('click', '.close_cover_i', function () {
    $('.app_cover_box').css('display', 'none');
})

$('.upload_app_info_input').on('click', '.upload_app_info_id_copy', function () {
    let id = $(this).attr('data-id') || '';
    console.log('id', id)
    copyData(id);
})

$('.app_header_box').on('click', '.people_head_sculpture', function () {
    window.location.href = 'cyfs://static/info.html';
})
