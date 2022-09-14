import $ from 'jquery';
import * as cyfs from '../cyfs_sdk/cyfs'
let QRCode = require('qrcode')
import { toast } from './lib/toast.min'
import { ObjectUtil, formatDate, LANGUAGESTYPE, castToLocalUnit } from './lib/util'

$(async function(){
    if(LANGUAGESTYPE == 'zh'){
        $('title').html('创建DID');
    }else{
        $('title').html('创建DID');
    }
});

// header render
ObjectUtil.renderHeaderInfo();

$('.app_header_box').on('click', '.people_head_sculpture', function () {
    window.location.href = 'cyfs://static/info.html';
})

$('.cover_box').on('click', '.close_cover_i', function () {
    $('.cover_box').css('display', 'none');
})


