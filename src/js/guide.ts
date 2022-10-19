import * as cyfs from '../cyfs_sdk/cyfs'
import $ from 'jquery'
let QRCode = require('qrcode')
import { toast } from './lib/toast.min'
import { LANGUAGESTYPE } from './lib/util'



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

$('.browser_guide_btn').on('click', async function () {
    let next = $(this).attr('data-next');
    let current = $(this).attr('data-current');
    $('.' + current).css('display', 'none');
    $('.' + current).addClass('animate__animated animate__slideOutLeft');
    $('.' + next).css('display', 'block');
    $('.' + next).addClass('animate__animated animate__slideInRight');
    setTimeout(function(){
        $('.' + current).removeClass('animate__animated animate__slideOutLeft');
        $('.' + next).removeClass('animate__animated animate__slideInRight');
    }, 1000);
    console.log('---next', next)
    if(next == 'browser_guide_acivate_box'){
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
    window.location.href = 'cyfs://static/browser.html';
})

$('.guide_switch_box span').on('click', function () {
    let next = $(this).attr('data-next');
    let current = $(this).attr('data-current');
    let direction = $(this).attr('data-direction');
    if(next && current){
        if(direction == 'left'){
            $('.' + current).css('display', 'none');
            $('.' + current).addClass('animate__animated animate__slideOutLeft');
            $('.' + next).css('display', 'block');
            $('.' + next).addClass('animate__animated animate__slideInRight');
        }else{
            $('.' + current).css('display', 'none');
            $('.' + current).addClass('animate__animated animate__slideOutRight');
            $('.' + next).css('display', 'block');
            $('.' + next).addClass('animate__animated animate__slideInLeft');
        }
        setTimeout(function(){
            $('.' + current).removeClass('animate__animated animate__slideOutLeft animate__slideOutRight');
            $('.' + next).removeClass('animate__animated animate__slideInRight animate__slideInLeft');
        }, 1000);
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
