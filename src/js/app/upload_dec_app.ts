import $ from 'jquery';
import * as cyfs from '../../cyfs_sdk/cyfs'
import { toast } from '../lib/toast.min'
import { ObjectUtil, formatDate, LANGUAGESTYPE } from '../lib/util'
import { isBind, AppUtil } from './app_util'

let g_isBind:boolean;

$(async function(){
    if(LANGUAGESTYPE == 'zh'){
        $('title').html('应用管理');
    }else{
        $('title').html('Dec App Store');
    }
    let g_isBind = await isBind();
    if(!g_isBind){
        window.location.href = 'cyfs://static/browser.html';
    }
});
