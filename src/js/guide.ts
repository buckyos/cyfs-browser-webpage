import * as cyfs from '../cyfs_sdk/cyfs'
import $ from 'jquery'
let QRCode = require('qrcode')
import { toast } from './lib/toast.min'
import { LANGUAGESTYPE } from './lib/util'

var userAgentInfo = navigator.userAgent;
console.log('userAgentInfo', userAgentInfo)
if(userAgentInfo.indexOf('Kalama') > -1){
    $('.browser_guide_index_title').html('Welcome to Kalama !');
    $('.kalama_title').html('Web3 starts with CYFS — We are committed to making Kalama the best browser for web3.');
    $('.kalama_subtitle').html('Kalama will support a variety of decentralized network protocols (currently supports CYFS, IPFS), allowing you to open Web3 links more easily and bring you a better browsing experience.');
    $('.browser_guide_index_icon').css('background', 'url(./img/browser_guide_index_kalama_icon.png) no-repeat center center');
}else{
    $('.browser_guide_index_title').html('Welcome to CYFS Browser !');
    $('.kalama_title').html('Web3 starts with CYFS — We are committed to making CYFS Browser the best browser for web3.');
    $('.kalama_subtitle').html('CYFS Browser will support a variety of decentralized network protocols (currently supports CYFS, IPFS), allowing you to open Web3 links more easily and bring you a better browsing experience.');
    $('.browser_guide_index_icon').css('background', 'url(./img/browser_guide_index_icon.svg) no-repeat center center');
}

let SCAN_CONTENT:{
    "flag": string,
    "type": string,
    "data": {
        "type": number,
        "ip": string[],
        "access_token": string
    }
};
let CHECK_STATUS:  Map<string, {last_access: number, access_count: number}>;
let isBindInterval: NodeJS.Timeout | null = null;
let isSwitchInterval: NodeJS.Timeout | null = null;
let g_switchEq:number = 1;

$(function(){
    if(LANGUAGESTYPE == 'zh'){
        $('title').html('欢迎');
    }else{
        $('title').html('Welcome');
    }
});

async function getScanContent(){
    $.ajax({
        url: 'http://127.0.0.1:1321/check',
        success:function(data){
            let result = JSON.parse(data);
            console.log('check-result', result);
            CHECK_STATUS = result.check_status;
            console.origin.log('CHECK_STATUS', CHECK_STATUS);
            let localIps = result.access_info.addrs;
            let access_token = result.access_info.access_token?result.access_info.access_token:'';
            SCAN_CONTENT = {
                "flag": "cyfs",
                "type": "bindDevice",
                "data": {
                    "type": 2,
                    "ip": localIps,
                    "access_token": access_token
                }
            }
        }
    })
}

getScanContent();

function isUnbind() {
    $.ajax({
        url: 'http://127.0.0.1:38090/status',
        success:function(result){
            console.log('getStatus-result', result);
            if (result.is_bind) {
                // 已绑定
                if (isBindInterval) {
                    clearInterval(isBindInterval);
                }
                $('.browser_guide_acivate_box').css('display','none');
                window.location.href = 'cyfs://static/browser.html?success';
            }
        }
      });
};

function setSwitchIntervalFun () {
    $('.guide_switch_box span').each(function(index){
        if($(this).hasClass('guide_switch_active_span')){
            if(index == 2) {
                g_switchEq = 0;
            }else{
                g_switchEq = index+1;
            }
        }
    })
    $('.guide_switch_box span').removeClass('guide_switch_active_span');
    $('.guide_switch_box span').eq(g_switchEq).click();
    if(g_switchEq == 2) {
        g_switchEq = 0;
    }else{
        g_switchEq ++ ;
    }
}

function initGuide(){
    $('.browser_guide_one_box').removeClass('box_display_none').addClass('box_display_block animate__animated animate__fadeIn');
    $('.guide_two_content_box, .app_footer_box, .browser_guide_success_box, .guide_switch_btn_box').addClass('box_display_block');
    if(typeof(isSwitchInterval) == 'number' || !isSwitchInterval){
        isSwitchInterval =  setInterval(() => {
            setSwitchIntervalFun();
        }, 5000);
    }
}
initGuide();

$('.browser_guide_btn').on('click', async function () {
    let next = $(this).attr('data-next');
    let current = $(this).attr('data-current');
    $('.' + current).removeClass('box_display_block').addClass('box_display_none');
    $('.' + next).removeClass('box_display_none').addClass('box_display_block animate__animated animate__fadeIn');
    setTimeout(function(){
        $('.' + next, '.' + current).removeClass('animate__animated animate__fadeIn animate__fadeOut');
    }, 1000);
    console.log('---next', next)
    if(next == 'browser_guide_one_box'){
        $('.guide_two_content_box, .app_footer_box, .browser_guide_success_box, .guide_switch_btn_box').addClass('box_display_block');
        if(typeof(isSwitchInterval) == 'number' || !isSwitchInterval){
            isSwitchInterval =  setInterval(() => {
                setSwitchIntervalFun();
            }, 5000);
        }
    }

    if(next && (next?.indexOf('guide_switch_btn_box') > -1)){
        if(typeof(isSwitchInterval) == 'number' || !isSwitchInterval){
            isSwitchInterval =  setInterval(() => {
                setSwitchIntervalFun();
            }, 5000);
        }
    }
    if(next == 'browser_guide_acivate_box'){
        g_switchEq = 1;
        if(isSwitchInterval){
            clearInterval(isSwitchInterval);
        }
        $('.guide_switch_box span').removeClass('guide_switch_active_span');
        $('.guide_switch_box span').eq(0).addClass('guide_switch_active_span');
        $('.guide_two_content_box, .app_footer_box, .browser_guide_success_box, .guide_switch_btn_box, .browser_guide_box').removeClass('box_display_block').addClass('box_display_none');
        if(!SCAN_CONTENT){
            await getScanContent();
        }
        QRCode.toCanvas(document.getElementById('scan_canvas'), JSON.stringify(SCAN_CONTENT), {
            errorCorrectionLevel: 'L',
            width: 144,
            height: 144,
            margin: 0
        });
        if(typeof(isBindInterval) == 'number' || !isBindInterval){
            isBindInterval = setInterval(() => {
                isUnbind();
            }, 2000);
        }
    }else{
        if(isBindInterval){
            clearInterval(isBindInterval);
        }
    }
})

$('.guide_skip_btn').on('click', function () {
    $('.guide_shadow_box').css('display', 'block');
})

$('.guide_confirm_cancel_btn').on('click', function () {
    $('.guide_shadow_box').css('display', 'none');
})

$('.guide_confirm_yes_btn, .guide_acivate_success_cancel_btn, .browser_cyfs_icon').on('click', function () {
    window.location.href = 'https://browser.cyfs.com/init.html';
})

$('.guide_switch_box span').on('click', function () {
    if(isSwitchInterval){
        clearInterval(isSwitchInterval);
    }
    $('.guide_switch_box span').removeClass('guide_switch_active_span');
    $(this).addClass('guide_switch_active_span');
    let current = $(this).attr('data-current');
    if(current){
        $('.browser_guide_one_box, .browser_guide_two_box, .browser_guide_three_box').removeClass('box_display_block').addClass('box_display_none');
        $('.' + current).addClass('animate__animated animate__fadeIn box_display_block');
        setTimeout(function(){
            $('.browser_guide_one_box, .browser_guide_two_box, .browser_guide_three_box').removeClass('animate__animated animate__fadeIn animate__fadeOut');
        }, 1000);
    }
    if(typeof(isSwitchInterval) == 'number' || !isSwitchInterval){
        isSwitchInterval =  setInterval(() => {
            setSwitchIntervalFun();
        }, 5000);
    }
})

$('.guide_content_box').on('click', '.did_click', function (e) {
    if($(e.target).closest(".close_window_i").length == 0){
        $('.info_floating_window').css('display', 'block');
    }
})

$('.guide_content_box').on('click', '.close_window_i', function () {
    $('.guide_content_box .info_floating_window, .guide_content_box .ood_floating_window').css('display', 'none');
})

$('.guide_content_box').on('click', '.ood_click', function (e) {
    if($(e.target).closest(".close_window_i").length == 0){
        $('.ood_floating_window').css('display', 'block');
    }
})
$('.href_to_did').on('click', function () {
    let hrefTo = $(this).attr('data-to');
    if(hrefTo == 'reset'){
        chrome.runtime.sendMessage('aflijdlgeaclgadgbihdcjpifncfbfle', {"type":"TORESETDID","data":""}, function (data) {
            console.log('chrome-reset-data', data)
        });
    }else{
        chrome.runtime.sendMessage('aflijdlgeaclgadgbihdcjpifncfbfle', {"type":"TOCREATEDID","data":""}, function (data) {
            console.log('chrome-create-data', data)
        });
    }
})

$('.did_title_intro_btn').on('click', function () {
    let box = $(this).attr('data-box');
    if(box){
        $('.did_introduce_cover_container, .'+box).css('display', 'block');
    }
})

$('.did_intro_close_i').on('click', function () {
    $('.did_introduce_cover_container, .did_intro_container').css('display', 'none');
})

