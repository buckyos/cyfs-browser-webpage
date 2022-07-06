import "../../css/m_main.css"

import * as cyfs from '../../cyfs_sdk/cyfs'
let QRCode = require('qrcode')
import { ObjectUtil, formatDate, getSubStr, castToLocalUnit, getIsAnonymousMode } from '../lib/util'

let object_id: cyfs.ObjectId;
class Util {
    m_sharedStatck: cyfs.SharedObjectStack;
    m_util_service: cyfs.UtilRequestor;
    m_router: cyfs.NONRequestor;
    constructor() {
        this.m_sharedStatck = cyfs.SharedObjectStack.open_runtime();
        this.m_util_service = this.m_sharedStatck.util();
        this.m_router = this.m_sharedStatck.non_service();
    }
    async test() {
        // Device静态信息
        let current_device_static_info = await this.m_util_service.get_device_static_info({ common: { flags: 0 } });
        if (!current_device_static_info.err) {
            current_device_static_info = current_device_static_info.unwrap().info;
        }
        console.info('current_device_static_info:', current_device_static_info);
        object_id = current_device_static_info.device_id.object_id;
        document.getElementById('friendly_name')!.innerHTML = current_device_static_info.device.name();
        if (window.location.search.split("?")[1]) {
            let str = window.location.search.split("?")[1];
            if (str == 'owner' && current_device_static_info.owner_id) {
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
        }
        console.log('object_id', object_id)
        document.getElementById('device_id_info')!.innerHTML = object_id.to_base_58();
        meta_client.getBalanceInfo()
        meta_client.getCollectTxList()
    }
}
const util = new Util();
util.test()
class MetaClient {
    meta_client: cyfs.MetaClient;
    constructor() {
        // this.meta_client = cyfs.get_meta_client(cyfs.MetaMinerTarget.Test);
        // 空参数或'test'为测试链，传'dev'为正式链
        this.meta_client = cyfs.create_meta_client();
        console.log('get_meta_client', this.meta_client)
        console.log('MetaMinerTarget', cyfs.MetaMinerTarget)
    }
    // 获取余额
    async getBalanceInfo() {
        let balance = castToLocalUnit((await this.meta_client.getBalance(0, object_id.toString()))?.result);
        let balance2 = castToLocalUnit((await this.meta_client.getFileRewardAmount(object_id.toString())).result);
        document.getElementById('balance_dom')!.innerHTML = balance2;
        document.getElementById('balance_dom2')!.innerHTML = balance;
    }
    // 获取转账列表
    async getCollectTxList() {
        let txLists = (await this.meta_client.getCollectTxList([object_id.toString()], 0, 10000, null, null, ["0", "1"]))?.result;
        let open_table_tbody = document.getElementById('open_table_tbody')!;
        let txHtml = '';
        if (txLists) {
            console.log('---------------txLists', txLists)
            txLists.forEach(element => {
                txHtml += `<tr>
                                <td>${getSubStr(element.from)}</td>
                                <td>${getSubStr(element.hash)}</td>
                                <td class="color_999">${formatDate(Number(element.create_time))}</td>
                                <td class="color_999">${castToLocalUnit(Number(element.value))}ECC</td>
                            </tr>`
            });

        } else {
            txHtml = '<p>暂无数据</p>'
        }
        open_table_tbody.innerHTML = txHtml;
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

$('.with_drawal').on('click', () => {
    withdrawal();
})

setInterval(() => { meta_client.getBalanceInfo() }, 60000);
setInterval(() => { meta_client.getCollectTxList() }, 60000);

$('#reward_record_cover_box').on('click', (event) => {
    document.getElementById('reward_record_cover_box')!.style.display = 'none'
})
