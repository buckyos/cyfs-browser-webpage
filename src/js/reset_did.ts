import $ from 'jquery';
import * as cyfs from '../cyfs_sdk/cyfs'
let QRCode = require('qrcode')
import { toast } from './lib/toast.min'
import { ObjectUtil, formatDate, LANGUAGESTYPE, castToLocalUnit } from './lib/util'

$(async function(){
    if(LANGUAGESTYPE == 'zh'){
        $('title').html('重置DID');
    }else{
        $('title').html('Reset DID');
    }
});
let g_mnemonic:string = '';

// header render
ObjectUtil.renderHeaderInfo();

$('.app_header_box').on('click', '.people_head_sculpture', function () {
    window.location.href = 'cyfs://static/info.html';
})

$('.did_verify_btn').on('click', function () {
    g_mnemonic = String($('.recovery_phrase_textarea').val());
    console.origin.log('---g_mnemonic:', g_mnemonic)
    let mnemonicR = cyfs.bip39.validateMnemonic(g_mnemonic);
    console.origin.log("gen mnemonicR:", mnemonicR);
    if(mnemonicR){
        $('.reset_did_step_one_box').css('display', 'none');
        $('.reset_did_step_two_box').css('display', 'block');
    }else{
        toast({
            message: 'Recovery Phrase Validation Error',
            time: 1500,
            type: 'warn'
        });
    }
})
$('.choose_ood_btn').on('click', function () {
    window.location.href = 'https://vfoggie.fogworks.io/?url=cyfs://static/reset_did.html&desc=#/login';
})



