import "../../css/m_main.css"

import * as cyfs from '../../cyfs_sdk/cyfs'
import $ from 'jquery';
import { ObjectUtil, getSubStr, hasPC, castToLocalUnit } from '../lib/util'

let ISPC = hasPC();
function isUnbind() {
    let url = 'http://127.0.0.1:1321/check';
    let ajax = new XMLHttpRequest();
    ajax.open('get', url, true);
    ajax.send();
    ajax.onreadystatechange = function () {
        if (ajax.readyState == 4 && ajax.status == 200) {
            console.log('JSON.parse(ajax.responseText)', JSON.parse(ajax.responseText))
            const result = JSON.parse(ajax.responseText);
            if (!result.activation) {
                if (ISPC) {
                    window.location.href = 'cyfs://static/init.html';
                } else {
                    window.location.href = 'cyfs://static/activate.html';
                }
            }
        }
    }
};
isUnbind();

function getfilesize(size: number) {
    if (!size)
        return "0B";
    let num = 1024.00; // byte
    if (size < num)
        return size + "B";
    if (size < Math.pow(num, 2))
        return (size / num).toFixed(0) + "KB"; // kb
    if (size < Math.pow(num, 3))
        return (size / Math.pow(num, 2)).toFixed(0) + "MB"; // M
    if (size < Math.pow(num, 4))
        return (size / Math.pow(num, 3)).toFixed(0) + "G"; // G
    return (size / Math.pow(num, 4)).toFixed(0) + "T"; // T
}

let cpuProgress = document.querySelector("#cpu_progress")!;
let cpuProgressSpan = document.querySelector("#cpu_progress_span")!;
let memoryProgress = document.querySelector("#memory_progress")!;
let memoryProgressSpan = document.querySelector("#memory_progress_span")!;
let memoryProgressP = document.querySelector("#memory_progress_p")!;
let uploadProgressP = document.querySelector("#upload_progress_p")!;
let downloadProgressP = document.querySelector("#download_progress_p")!;

function unBindFunc() {
    alert("暂未实现");
};

let current_device_static_info: cyfs.DeviceStaticInfo;
let target: cyfs.ObjectId | undefined;
let infoInterval: NodeJS.Timeout;
class Util {
    m_sharedStatck: cyfs.SharedObjectStack;
    m_util_service: cyfs.UtilRequestor;
    m_router: cyfs.NONRequestor;
    meta_client: cyfs.MetaClient;

    constructor() {
        this.m_sharedStatck = cyfs.SharedObjectStack.open_runtime();
        this.m_util_service = this.m_sharedStatck.util();
        // 空参数或'test'为测试链，传'dev'为正式链
        this.meta_client = cyfs.create_meta_client();
        this.m_router = this.m_sharedStatck.non_service();
    }

    async getInfo() {
        await this.getDeviceInfo();
        this.getSystemInfo();
        this.getOodStatus();
        this.getNocStat();
        this.getNetworkAccessInfo();
        this.getBalance();
        infoInterval = setInterval(() => {
            if (window.location.pathname == '/info.html' || window.location.pathname == '/mobile/info.html') {
                this.getSystemInfo();
            } else {
                clearInterval(infoInterval)
            }
        }, 1000);
    }

    async getSystemInfo() {
        let req = {
            common: {
                target: target,
                flags: 0
            },
        }
        console.log('---req', req)
        let systemInfo = await this.m_util_service.get_system_info(req);
        if (!systemInfo.err) {
            systemInfo = systemInfo.unwrap().info;
        }
        console.log('systemInfo:', systemInfo);
        // cpu进度条
        cpuProgressSpan.innerHTML = systemInfo.cpu_usage.toFixed(0) + '%';
        cpuProgress.setAttribute("stroke-dasharray", String(systemInfo.cpu_usage * 3) + ",1000");

        // 内存
        let memoryNum = 0;
        if (systemInfo.total_memory === 0) {
            memoryNum = 0;
            memoryProgressSpan.innerHTML = '0%';
        } else {
            memoryNum = Number((systemInfo.used_memory * 100 / systemInfo.total_memory).toFixed(0));
            memoryProgressSpan.innerHTML = memoryNum + '%';
        }
        memoryProgress.setAttribute("stroke-dasharray", String((systemInfo.used_memory * 300 / systemInfo.total_memory).toFixed(0)) + ",1000");
        if (memoryNum >= 90) {
            memoryProgress.setAttribute("stroke", "#CF1655");
        } else {
            memoryProgress.setAttribute("stroke", "#00CC99");
        }

        memoryProgressP.innerHTML = "内存" + getfilesize(systemInfo.used_memory) + '/' + getfilesize(systemInfo.total_memory)

        // 上传
        uploadProgressP.innerHTML = '上传' + getfilesize(systemInfo.transmitted_bytes) + '/S';

        // 下载
        downloadProgressP.innerHTML = '下载' + getfilesize(systemInfo.received_bytes) + '/S';

    }

    async getDeviceInfo() {
        // Device静态信息
        let current_device_static_info_result = await this.m_util_service.get_device_static_info({ common: { flags: 0 } });
        if (!current_device_static_info_result.err) {
            current_device_static_info = current_device_static_info_result.unwrap().info;
        }
        console.log('current_device_static_info', current_device_static_info)
        document.getElementById('device_id')!.innerHTML = current_device_static_info.device_id.object_id.toString();
        if (window.location.search.split("?")[1]) {
            let str = window.location.search.split("?")[1];
            if (str == 'owner' && current_device_static_info.owner_id) {
                let owner_id = await this.m_util_service.resolve_ood({ common: { flags: 0 }, object_id: current_device_static_info.owner_id });
                if (!owner_id.err) {
                    owner_id = owner_id.unwrap();
                    console.log('owner_id', owner_id);
                    if (owner_id.device_list[0]) {
                        target = owner_id.device_list[0].object_id;
                    }
                    document.getElementById('device_id')!.innerHTML = target?.toString() ? target?.toString() : '';
                } else {
                    target = undefined;
                }
            } else {
                target = undefined;

            }
            console.log('target', target)
        }
        console.log('current_device_static_info:', current_device_static_info, current_device_static_info.device.name());
        if (ISPC) {
            document.getElementById('zone_id')!.innerHTML = `<a class="color_0c9" href="cyfs://static/object_browser/objects.html?id=${current_device_static_info.zone_id.object_id.toString()}">${current_device_static_info.zone_id.object_id.toString()}</a>`;
            document.getElementById('owner_id')!.innerHTML = `<a class="color_0c9" href="cyfs://static/object_browser/objects.html?owner=${current_device_static_info.owner_id?.toString()}">${current_device_static_info?.owner_id?.toString()}</a>`;
        } else {
            document.getElementById('zone_id')!.innerHTML = `<a class="color_0c9" href="cyfs://static/mobile/objects.html?id=${current_device_static_info.zone_id.object_id.toString()}">${current_device_static_info.zone_id.object_id.toString()}</a>`;
            document.getElementById('owner_id')!.innerHTML = `<a class="color_0c9" href="cyfs://static/mobile/objects.html?owner=${current_device_static_info.owner_id?.toString()}">${current_device_static_info?.owner_id?.toString()}</a>`;
        }
        let area_obj = null;
        if (target) {
            let owner_obj = await ObjectUtil.getObject({ id: target, isReturnResult: true })
            area_obj = owner_obj.object.object.desc().area();
            document.getElementById('title_box')!.innerHTML = owner_obj.object.object.name();
        } else {
            area_obj = current_device_static_info.device.desc().area();
            document.getElementById('title_box')!.innerHTML = current_device_static_info.device.name() || '';
        }
        // 区域代码
        let area_unwrap = area_obj.unwrap();
        console.log('area_unwrap', area_unwrap)

        if (!area_unwrap.country && !area_unwrap.city) {
            document.getElementById('area_code')!.innerHTML = '其它';
        } else {
            let area = area_obj.value.get_area_info();
            if (area) {
                if (area.country_name && area.city_name) {
                    document.getElementById('area_code')!.innerHTML = area.country_name + ',' + area.state_name + ',' + area.city_name;
                }
            }
        }

    }

    async getOodStatus() {
        // OOD连接状态信息
        let ood_status = await this.m_util_service.get_ood_status({ common: { flags: 0 } });
        if (!ood_status.err) {
            ood_status = ood_status.unwrap().status;
        }
        console.log('ood_status:', ood_status);
        if (ood_status.cont_fail_count >= 3) {
            document.getElementById('id_ood_online')!.innerHTML = 'OOD不在线';
        } else {
            document.getElementById('id_ood_online')!.innerHTML = 'OOD在线';
        }
    }

    async getNocStat() {
        // NOC统计信息
        let req = {
            common: {
                target: target,
                flags: 0
            },
        }
        let noc_stat = await this.m_util_service.get_noc_info(req);
        if (!noc_stat.err) {
            noc_stat = noc_stat.unwrap().stat;
        }
        console.log('noc_stat:', noc_stat);
        document.getElementById('named_object')!.innerHTML = noc_stat.count;
        document.getElementById('chunk')!.innerHTML = noc_stat.storage_size + '(' + getfilesize(noc_stat.storage_size) + ')';
    }

    async getNetworkAccessInfo() {
        let req = {
            common: {
                target: target,
                flags: 0
            },
        }
        let network_access_info_result = await this.m_util_service.get_network_access_info(req);
        let network_access_info;
        if (!network_access_info_result.err) {
            network_access_info = network_access_info_result.unwrap().info;
        }
        console.log('get_network_access_info:', network_access_info);
        let v4_info = network_access_info.v4;
        console.log('---------------v4_info', v4_info)
        let address_infos: cyfs.BdtNetworkAccessEndpoint[] = [];
        let first_address_info: cyfs.BdtNetworkAccessEndpoint | null = null;
        if (network_access_info.sn) {
            document.getElementById('sn_info')!.innerHTML = getSubStr(network_access_info.sn[0].sn.object_id.toString());
            document.getElementById('sn_info_connnet')!.innerHTML = network_access_info.sn[0].sn_status == 'online' ? '已连接' : '未连接';
        }
        if (v4_info) {
            v4_info.forEach((element: cyfs.BdtNetworkAccessEndpoint) => {
                if (JSON.stringify(element.lan_ep) != "{}") {
                    if (element.lan_ep.protocol == 2 && element.lan_ep.addr.ip != element.wan_ep.addr.ip) {
                        first_address_info = element;
                    } else if (element.lan_ep.protocol == 2 || element.lan_ep.addr.ip != element.wan_ep.addr.ip) {
                        address_infos.unshift(element);
                    } else {
                        address_infos.push(element);
                    }
                }
            });
            if (first_address_info) {
                address_infos.unshift(first_address_info);
            }
            if (address_infos) {
                if (JSON.stringify(address_infos[0].lan_ep) == "{}" && JSON.stringify(address_infos[0].wan_ep.addr.ip) != "{}") {
                    document.getElementById('internet_show')!.setAttribute('style', 'display:flex')
                    document.getElementById('intranet_show')!.setAttribute('style', 'display:none')
                    if (document.getElementById('intranet_show_box')) {
                        document.getElementById('intranet_show_box')!.setAttribute('style', 'display:none')
                    }
                    if (document.getElementById('internet_show_box')) {
                        document.getElementById('internet_show_box')!.setAttribute('style', 'display:block')
                    }
                } else {
                    document.getElementById('internet_show')!.setAttribute('style', 'display:none')
                    document.getElementById('intranet_show')!.setAttribute('style', 'display:flex')
                    if (document.getElementById('internet_show_box')) {
                        document.getElementById('internet_show_box')!.setAttribute('style', 'display:none')
                    }
                    if (document.getElementById('intranet_show_box')) {
                        document.getElementById('intranet_show_box')!.setAttribute('style', 'display:block')
                    }
                }
                if (JSON.stringify(address_infos[0].lan_ep) != "{}") {
                    document.getElementById('intranet_address')!.innerHTML = address_infos[0].lan_ep.addr.ip;
                }
                if (JSON.stringify(address_infos[0].wan_ep) != "{}") {
                    document.getElementById('internet_address')!.innerHTML = address_infos[0].wan_ep.addr.ip;
                }
            }
        }
    }
    async getBalance() {
        // 设备余额
        let id = current_device_static_info.device_id.object_id;
        if (target) {
            id = target;
        }
        let balance = castToLocalUnit((await this.meta_client.getBalance(0, id.toString()))?.result);
        document.getElementById('balance_device')!.innerHTML = balance;
    }

}
const util = new Util();
util.getInfo();

function toTx() {
    if (target) {
        if (ISPC) {
            window.location.href = "cyfs://static/tx.html?owner";
        } else {
            window.location.href = "cyfs://static/mobile/tx.html?owner";
        }
    } else {
        if (ISPC) {
            window.location.href = "cyfs://static/tx.html";
        } else {
            window.location.href = "cyfs://static/mobile/tx.html";
        }
    }
}



// auto add event

$('.view_transfer_records').on('click', (event) => {
    toTx()
})
