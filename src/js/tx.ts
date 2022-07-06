import * as cyfs from '../cyfs_sdk/cyfs'
let QRCode = require('qrcode')
import { ObjectUtil, formatDate, getSubStr, castToLocalUnit, STATUSTYPE, LANGUAGESTYPE, TXTYPES } from './lib/util'

$(function(){
    if(LANGUAGESTYPE == 'zh'){
        $('title').html('打赏记录');
    }else{
        $('title').html('Reward Record');
    }
});
let object_id: cyfs.ObjectId;
let PAGE_INDEX = 0;
let TX_LENGTH:number = 0;
let CHANNEL = 'beta';
let IS_RETURN: boolean = false;
class Util {
    m_sharedStatck: cyfs.SharedCyfsStack;
    m_util_service: cyfs.UtilRequestor;
    m_router: cyfs.NONRequestor;
    constructor() {
        this.m_sharedStatck = cyfs.SharedCyfsStack.open_runtime();
        this.m_util_service = this.m_sharedStatck.util();
        this.m_router = this.m_sharedStatck.non_service();
    }
    async getInfo() {
        // Device静态信息
        let current_device_static_info = await this.m_util_service.get_device_static_info({ common: { flags: 0 } });
        if (!current_device_static_info.err) {
            current_device_static_info = current_device_static_info.unwrap().info;
        }
        console.info('current_device_static_info:', current_device_static_info);
        object_id = current_device_static_info.device_id.object_id;
        document.getElementById('friendly_name')!.innerHTML = current_device_static_info.device.name();
        if (current_device_static_info.owner_id) {
            let owner_id = await this.m_util_service.resolve_ood({ common: { flags: 0 }, object_id: current_device_static_info.owner_id });
            if (!owner_id.err) {
                owner_id = owner_id.unwrap();
                console.log('owner_id', owner_id);
                if (owner_id.device_list[0]) {
                    object_id = owner_id.device_list[0].object_id;
                    let result = await ObjectUtil.getObject({ id: object_id, isReturnResult: true })
                    if (result.object.object.name()) {
                        document.getElementById('friendly_name')!.innerHTML = result.object.object.name();
                    }

                }
            }
        }
        console.log('object_id', object_id)
        document.getElementById('device_id_info')!.innerHTML = object_id.to_base_58();
        meta_client.getBalanceInfo()
        meta_client.getCollectTxList()
    }
}
const util = new Util();
class MetaClient {
    meta_client: cyfs.MetaClient;
    constructor() {
        // 空参数或'test'为测试链，传'dev'为正式链
        this.meta_client = cyfs.create_meta_client();
        console.log('get_meta_client', this.meta_client)
        console.log('MetaMinerTarget', cyfs.MetaMinerTarget)
    }
    // 获取余额
    async getBalanceInfo() {
        let balance = castToLocalUnit(Number((await this.meta_client.getBalance(0, object_id.toString()))?.result));
        let balance2 = castToLocalUnit(Number((await this.meta_client.getFileRewardAmount(object_id.toString())).result));
        console.log('---------------balance, balance2', balance, balance2);
        $('#balance_dom').html(balance2);
        document.getElementById('balance_dom2')!.innerHTML = balance;
    }
    // 获取转账列表
    async getCollectTxList(operation?:string) {
        if(!IS_RETURN){
            IS_RETURN = true;
        }else{
            return;
        }
        if(operation == 'add'){
            PAGE_INDEX ++ ;
        }else if(operation == 'reduce'){
            PAGE_INDEX -- ;
        }
        let txLists = (await this.meta_client.getCollectTxList([object_id.toString()], PAGE_INDEX*10, 10, null, null, ["0", "1"]))?.result;
        let open_table_tbody = document.getElementById('open_table_tbody')!;
        let txHtml = '';
        if (txLists && txLists.length ) {
            console.origin.log('---------------txLists',PAGE_INDEX, txLists);
            let hashRouter = CHANNEL == 'beta'? 'https://beta.browser.cyfs.com/business_detail.html?':'https://dev.browser.cyfs.com/business_detail.html?';
            txLists.forEach(element => {
                txHtml += `<tr>
                                <td><a class="color_475" href="${hashRouter + element.hash}" target="_blank">${getSubStr(element.hash)}</a></td>
                                <td>${formatDate(Number(element.create_time))}</td>
                                <td>${element.desc == '转账'?TXTYPES[0][LANGUAGESTYPE]:TXTYPES[1][LANGUAGESTYPE]}</td>
                                <td><a class="color_475" href="./object_browser/objects.html?id=${element.from}" target="_blank">${getSubStr(element.from)}</a></td>
                                <td>100 Qiu</td>
                                <td>${castToLocalUnit(Number(element.value))} ECC</td>
                                <td>${element.result<=1 ? STATUSTYPE[element.result][LANGUAGESTYPE] : STATUSTYPE[1][LANGUAGESTYPE]}</td>
                            </tr>`;
            });
            if (PAGE_INDEX > 0 && $('#page_div span').eq(PAGE_INDEX).siblings().length < PAGE_INDEX) {
                $('#page_div').append(`<span>${PAGE_INDEX+1}</span>`);
            }
            TX_LENGTH = txLists.length;
            $('#page_div span').eq(PAGE_INDEX).addClass('choose_index').siblings().removeClass("choose_index");
            open_table_tbody.innerHTML = txHtml;
        }
        IS_RETURN = false;
    }
}
const meta_client = new MetaClient();

function withdrawal() {
    document.getElementById('reward_record_cover_box')!.style.display = 'block';
    document.getElementById('reward_record_scan')!.innerHTML = '';
    QRCode.toCanvas(document.getElementById('reward_record_scan'), object_id.to_base_58(), {
        errorCorrectionLevel: 'L',
        width: 84,
        height: 84,
        margin: 0
    });
}

$('.reward_record_div_box').on('click','.with_drawal', () => {
    withdrawal();
})

$('.anonymous_subtitle').on('click', async function () {
    window.open('cyfs://static/guide.html');
})

$.ajax({
    url: 'http://127.0.0.1:38090/status',
    success:function(result){
        console.log('getStatus-result', result);
        CHANNEL = result.channel;
        if(result.anonymous){
            $('.anonymous_box').css('display', 'block');
        }
        util.getInfo();
    }
});

setInterval(() => { meta_client.getBalanceInfo() }, 60000);

$('#reward_record_cover_box').on('click', (event) => {
    document.getElementById('reward_record_cover_box')!.style.display = 'none'
})

$('.last_page, .next_page_btn').on('click', () => {
    if(TX_LENGTH == 10){
        meta_client.getCollectTxList('add');
    }
})

$('.first_page, .last_page_btn').on('click', () => {
    if(PAGE_INDEX > 0){
        meta_client.getCollectTxList('reduce');
    }
})
