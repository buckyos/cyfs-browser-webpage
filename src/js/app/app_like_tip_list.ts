import $ from 'jquery';
import * as cyfs from '../../cyfs_sdk/cyfs'
let QRCode = require('qrcode')
import { toast } from '../lib/toast.min'
import { ObjectUtil, formatDate, LANGUAGESTYPE, castToLocalUnit } from '../lib/util'
import { isBind, AppUtil } from './app_util'

let g_isBind:boolean;
let g_owner: cyfs.ObjectId;
let g_appIdList: cyfs.ObjectId[];
let g_appList:{ app_id: cyfs.ObjectId | string, app_name: string, app_icon: string, fidArray: { fid: cyfs.ObjectId, version: string }[], owner: cyfs.ObjectId | undefined, app: cyfs.DecApp }[] = [];
let g_appId:string = '';

$(async function(){
    if(LANGUAGESTYPE == 'zh'){
        $('title').html('打赏列表');
    }else{
        $('title').html('Tip list');
    }
    let g_isBind = await isBind();
    if(!g_isBind){
        window.location.href = 'cyfs://static/browser.html';
    }
});

if (window.location.search.split("?")[1]) {
    let str = window.location.search.split("?")[1];
    let arr = str.split('&');
    if (arr) {
        for (let i = 0; i < arr.length; i++) {
            if (arr[i].indexOf('=') > -1 && arr[i].split('=')[1] && arr[i].split('=')[0] == 'id') {
                g_appId = arr[i].split('=')[1];
            }else{
                g_appId = arr[i];
            }
        }
    }
}
console.log('---------g_appId:', g_appId);

class AppListClass {
    m_sharedStatck: cyfs.SharedCyfsStack;
    m_util_service: cyfs.UtilRequestor;
    m_router: cyfs.NONRequestor;
    meta_client: cyfs.MetaClient;

    constructor() {
        this.m_sharedStatck = cyfs.SharedCyfsStack.open_runtime();
        this.m_router = this.m_sharedStatck.non_service();
        this.m_util_service = this.m_sharedStatck.util();
        this.meta_client = cyfs.create_meta_client();
    }
    
    async getOwner () {
        let result = await this.m_util_service.get_device({ common: { flags: 0 } });
        if (!result.err) {
          result = result.unwrap();
        }
        let current_device = result.device
        g_owner = current_device.desc().owner().unwrap();
    }

    async getBalanceInfo() {
        let balance = castToLocalUnit(Number((await this.meta_client.getBalance(0, g_appId))?.result || 0));
        console.log('---------------balance', balance);
        $('.app_total_amount_p').html(LANGUAGESTYPE == 'zh'? `总金额: ${balance} ECC` : `Total amount: ${balance} ECC`);
    }

    async getAppInfo () {
        await AppList.getOwner();
        let app = await AppUtil.showApp(g_appId, false);
        console.origin.log('---------app-data:', app);
        if (app.app.desc().owner) {
            let appOwner = app.app.desc().owner().unwrap();
            if(g_owner.toString() == appOwner.toString()){
                $('.app_like_list_withdraw').css('display', 'block');
            }else{
                $('.app_like_list_tip').css('display', 'block');
            }
        }
    }

    async getTransList() {
        let txLists: cyfs.SPVTx[] = (await this.meta_client.getCollectTxList([g_appId], 0, 1000, null, null, ["0", "1"]))?.result || [];
        let txHtml:string = "";
        if (txLists && txLists.length ) {
            let tx: cyfs.SPVTx;
            for (let i = 0; i < txLists.length; i++) {
                tx = txLists[i];
                const peopleR = (await ObjectUtil.getObject({ id: tx.from, isReturnResult: true, flags: 1 })).object;
                console.origin.log('peopleR:', peopleR);
                let peopleName = peopleR.object.name() || '';
                txHtml += `<tr>
                                <td>
                                    <i class="app_records_people_i">&nbsp;</i>
                                    ${peopleName}
                                </td>
                                <td>${castToLocalUnit(Number(tx.value))} ECC</td>
                                <td>${formatDate(Number(tx.create_time))}</td>
                            </tr>`;
            };
            $('.app_tx_list').html(txHtml);
        }
    }
}

export const AppList = new AppListClass;
AppList.getAppInfo();
AppList.getTransList();
AppList.getBalanceInfo();

$('.app_cover_box').on('click', '.close_cover_i', function () {
    $('.app_cover_box').css('display', 'none');
})

$('.app_like_list_withdraw, .app_like_list_tip').on('click', function () {
    $('.app_cover_box').css('display', 'block');
    document.getElementById('app_tip_scan_box')!.innerHTML = '';
    QRCode.toCanvas(document.getElementById('app_tip_scan_box'), g_appId, {
        errorCorrectionLevel: 'L',
        width: 112,
        height: 112,
        margin: 0
    });
})

$('.app_header_box').on('click', '.people_head_sculpture', function () {
    window.location.href = 'cyfs://static/info.html';
})

