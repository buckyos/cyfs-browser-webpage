import * as cyfs from '../cyfs_sdk/cyfs'
import $ from 'jquery';
import { ObjectUtil, getSubStr, LANGUAGESTYPE } from './lib/util'
import { toast } from './lib/toast.min'

$(function(){
    if(LANGUAGESTYPE == 'zh'){
        $('title').html('设备信息');
    }else{
        $('title').html('Device Info');
    }
});

let OWNER_ID:string = '';
let ZONE_ID:string = '';
let OOD_ID_LIST:cyfs.ObjectId[] = [];
let OOD_ID_STR_LIST:cyfs.ObjectId[] = [];
let MAIN_OOD_ID:cyfs.ObjectId;

function isUnbind() {
    $.ajax({
        url: 'http://127.0.0.1:38090/status',
        success:function(result){
            console.log('getStatus-result', result);
            if(result.anonymous){
                $('.anonymous_box').css('display', 'block');
            }else{
                if(!result.is_bind){
                    window.location.href = 'cyfs://static/init.html';
                }
            }
            util.getInfo();

        }
    });
};
isUnbind();

$('.anonymous_subtitle').on('click', async function () {
    window.open('cyfs://static/guide.html');
})

function getfilesize(size: number, isByte?: boolean) {
    if (!size)
        return "0KB";
    let num = 1024.00; // KB
    if(isByte){
        if(size < num){
            return size.toFixed(0) + "B";
        }else{
            size = size/1024;
        }
    }
    if (size < num)
        return size.toFixed(0) + "KB";
    if (size < Math.pow(num, 2))
        return (size / num).toFixed(0) + "MB"; // MB
    if (size < Math.pow(num, 3))
        return (size / Math.pow(num, 2)).toFixed(0) + "G"; // G
    // if (size < Math.pow(num, 4))
    else
        return (size / Math.pow(num, 3)).toFixed(0) + "T"; // T
}

let current_device_static_info: cyfs.DeviceStaticInfo;

class Util {
    m_sharedStatck: cyfs.SharedCyfsStack;
    m_util_service: cyfs.UtilRequestor;
    m_router: cyfs.NONRequestor;
    meta_client: cyfs.MetaClient;

    constructor() {
        this.m_sharedStatck = cyfs.SharedCyfsStack.open_runtime(cyfs.get_system_dec_app().object_id);
        this.m_util_service = this.m_sharedStatck.util();
        // 空参数或'test'为测试链，传'dev'为正式链
        this.meta_client = cyfs.create_meta_client();
        this.m_router = this.m_sharedStatck.non_service();
    }

    async getInfo() {
        this.getDeviceInfo();
    }

    async getDeviceList (target: cyfs.ObjectId) {
        $('.info_device_list_box').html();
        let zoneInfoR = await this.m_util_service.get_zone({common: { flags: 0, target: target }});
        console.origin.log('zoneInfoR', zoneInfoR)
        if(!zoneInfoR.err){
            let zoneInfo = zoneInfoR.unwrap().zone;
            let deviceList = zoneInfo.known_device_list();
            console.origin.log('deviceList', deviceList);
            let deviceHtml:string = '';
            for (let index = 0; index < deviceList.length; index++) {
                const element = (await ObjectUtil.getObject({ id: deviceList[index].object_id, isReturnResult: true })).object;
                if(element.object.name() != 'cyber-chat-1106c58d-d899-43c8-9a9a-bc008bf8aa4e' && element.object.name() != 'cyber-chat-local' && OOD_ID_STR_LIST.indexOf(deviceList[index].object_id.to_base_58()) < 0){
                    console.origin.log('---------device-element', element, element.object_id.to_base_58())
                    let status: boolean = await this.getOodStatus(element.object_id);
                    let area = 'Others';
                    let networkInfo;
                    let systemInfo;
                    if(status){
                        area = await this.getArea(element.object.desc().area().unwrap());
                        networkInfo = await this.getNetworkAccessInfo(element.object_id);
                        systemInfo = await this.getSystemInfo(element.object_id);
                    }
                    console.origin.log('---------device-systemInfo', systemInfo)
                    deviceHtml = `<div class="info_ood_box overflow_h">
                                    <div class="float_l info_ood_box_left">
                                        <div class="info_device_svg"></div>
                                        <p class="info_ood_p"><span class="info_ood_name device_name_ellipis">${element.object.name() || ''}</span></p>
                                        <p class="info_ood_p info_ood_padding_p">${getSubStr(element.object_id)} <i class="info_main_copy_svg info_main_copy_id_svg" data-id="${element.object_id}">&nbsp;</i></p>
                                    </div>
                                    <div class="float_r info_ood_box_right">
                                        <h3 class="info_content_title" >Connection Status</h3>
                                        <div class="info_connection_status">
                                            <div class="float_l">
                                                <p>
                                                    <span>Status :</span>
                                                    ${status?'<span class="color_287">Online</span>':'<span class="color_ed3">Not Online</span>'}
                                                </p>
                                                <p>
                                                    <span>LAN IP :</span>
                                                    <span>${networkInfo?.addressInfos[0]?.lan_ep.addr.ip || ''}</span>
                                                </p>
                                                <p>
                                                    <span>IPV4 :</span>
                                                    <span>NAT  Connect</span>
                                                </p>
                                            </div>
                                            <div class="float_l">
                                                <p>
                                                    <span>Region :</span>
                                                    <span>${area}</span>
                                                </p>
                                                <p>
                                                    <span>WAN IP :</span>
                                                    <span>${networkInfo?.addressInfos[0]?.wan_ep.addr.ip || ''}</span>
                                                </p>
                                                <p>
                                                    <span><b class="sn_pn_text">PN :</b><i class="info_intro_svg info_intro_pn_svg">&nbsp;<i class="info_floating_pn_window">PN: Proxy Service.</i></i></span>
                                                    <span>Not set</span>
                                                </p>
                                                
                                            </div>
                                            <div class="clear_both"></div>
                                        </div>
                                        <div class="info_connection_status">
                                            <div class="float_l" style="width:100%;margin-top:-16px;">
                                                <p>
                                                    <span><b class="sn_pn_text">SN :</b><i class="info_intro_svg info_intro_sn_svg">&nbsp;<i class="info_floating_sn_window">SN: Network Penetration Service.</i></i></span>
                                                    <span>${networkInfo?.snInfo.sn}${networkInfo?.snInfo.isOnline?'<i class="sn_info_svg sn_online_svg">&nbsp;</i>':'<i class="sn_info_svg sn_notonline_svg">&nbsp;</i>'}</span>
                                                </p>
                                            </div>
                                            <div class="clear_both"></div>
                                        </div>
                                        <h3 class="info_content_title">Running Status</h3>
                                        <ul class="info_device_box">
                                            <li>
                                                <div class="device_rom_svg"></div>
                                                <p class="device_item_name">RAM</p>
                                                <p class="device_item_intro">${getfilesize(systemInfo?.systemInfo?.used_memory || 0)}</p>
                                            </li>
                                            <li>
                                                <div class="device_host_svg"></div>
                                                <p class="device_item_name">hostname</p>
                                                <p class="device_item_intro">${systemInfo?.systemInfo?.name}</p>
                                            </li>
                                            <li>
                                                <div class="device_hdd_svg"></div>
                                                <p class="device_item_name">HDD</p>
                                                <p class="device_item_intro">Available ${getfilesize((systemInfo?.systemInfo?.hdd_disk_total-systemInfo?.systemInfo?.hdd_disk_avail) || 0, true)}/Total Capacity ${getfilesize(systemInfo?.systemInfo?.hdd_disk_total || 0, true)}</p>
                                            </li>
                                            <li>
                                                <div class="device_ssd_svg"></div>
                                                <p class="device_item_name">SSD</p>
                                                <p class="device_item_intro">Available ${getfilesize((systemInfo?.systemInfo?.ssd_disk_total-systemInfo?.systemInfo?.ssd_disk_avail) || 0, true)}/Total Capacity  ${getfilesize(systemInfo?.systemInfo?.ssd_disk_total || 0, true)}</p>
                                            </li>
                                        </ul>
                                    </div>
                                </div>`;
                    $('.info_device_list_box').append(deviceHtml);
                }
            }
        }
    }

    async setIntervalSystemInfo() {
        for (let index = 0; index < OOD_ID_LIST.length; index++) {
            const systemInfo = await this.getSystemInfo(OOD_ID_LIST[index]);
            let itemHtml = `<div class="circular_graph item_flex_grow_1">
                                <div class="circle_div">
                                    <svg xmlns="http://www.w3.org/200/svg" height="68" width="68">
                                        <circle cx="34" cy="34" r="31" fill="none" stroke="#E1E2E2" stroke-width="6" stroke-linecap="round"/>
                                        <circle class="circle_download" cx="34" cy="34" r="31" fill="none" stroke="${systemInfo.storageInfo.stroke}" stroke-width="6" stroke-dasharray="${systemInfo.storageInfo.dasharray}"/>
                                    </svg>
                                    <p class="circle_p"><span class="circle_span font_size12" style="color: ${systemInfo.cpuInfo.stroke}">${systemInfo.storageInfo.percentageInfo}</span></p>
                                </div>
                                <div class="circular_explain_box">
                                    <p class="circular_graph_p">Storage</p>
                                    <p >${systemInfo.storageInfo.innerInfo}</p>
                                </div>
                            </div> 
                            <div class="circular_graph item_flex_grow_1">
                                <div class="circle_div">
                                    <svg xmlns="http://www.w3.org/200/svg" height="68" width="68">
                                        <circle  cx="34" cy="34" r="31" fill="none" stroke="#E1E2E2" stroke-width="6" stroke-linecap="round"/>
                                        <circle class="circle_download" cx="34" cy="34" r="31" fill="none" stroke="${systemInfo.cpuInfo.stroke}" stroke-width="6" stroke-dasharray="${systemInfo.cpuInfo.dasharray}"/>
                                    </svg>
                                    <p class="circle_p"><span class="circle_span font_size16" style="color: ${systemInfo.cpuInfo.stroke}">${systemInfo.cpuInfo.innerInfo}</span></p>
                                </div>
                                <div>
                                    <p class="circular_graph_p">CPU</p>
                                </div>
                            </div> 
                            <div class="circular_graph item_flex_grow_1">
                                <div class="circle_div">
                                    <svg xmlns="http://www.w3.org/200/svg" height="68" width="68">
                                        <circle cx="34" cy="34" r="31" fill="none" stroke="#E1E2E2" stroke-width="6" stroke-linecap="round"/>
                                        <circle class="circle_download" cx="34" cy="34" r="31" fill="none" stroke="${systemInfo.ramInfo.stroke}" stroke-width="6" stroke-dasharray="${systemInfo.ramInfo.dasharray}"/>
                                    </svg>
                                    <p class="circle_p"><span class="circle_span font_size16"  style="color: ${systemInfo.cpuInfo.stroke}">${systemInfo.ramInfo.innerInfo}</span></p>
                                </div>
                                <div class="circular_explain_box">
                                    <p>RAM</p>
                                    <p >${systemInfo.ramInfo.info}</p>
                                </div>
                            </div> 
                            <div class="circular_graph item_flex_grow_1">
                                <div class="circle_div">
                                    <i class="upload_i"></i>
                                </div>
                                <div class="circular_explain_box">
                                    <p>Upload</p>
                                    <p >${systemInfo.uploadInfo.info}</p>
                                </div>
                            </div> 
                            <div class="circular_graph item_flex_grow_1">
                                <div class="circle_div">
                                    <i class="download_i"></i>
                                </div>
                                <div class="circular_explain_box">
                                    <p>Download</p>
                                    <p >${systemInfo.downloadInfo.info}</p>
                                </div>
                            </div>`;
            $('.info_ood_list_box .running_status_box_' + index).html(itemHtml);
        }
    }

    async getSystemInfo(id?: cyfs.ObjectId) {
        let req = {
            common: {
                target: id,
                flags: 0
            },
        }
        console.log('---req', req)
        let systemInfo = await this.m_util_service.get_system_info(req);
        if (!systemInfo.err) {
            systemInfo = systemInfo.unwrap().info;
            console.log('systemInfo:', systemInfo);
            // 内存
            let memoryNum = systemInfo.total_memory === 0 ? 0 : Number((systemInfo.used_memory * 100 / systemInfo.total_memory).toFixed(0));
            let perimeter = Math.PI*2*31;
            return {
                storageInfo: {
                    stroke: '#1DBFA2',
                    percentageInfo: (100-(systemInfo.ssd_disk_avail/systemInfo.ssd_disk_total)*100).toFixed(0) + '%',
                    dasharray: 200*(systemInfo.ssd_disk_total-systemInfo.ssd_disk_avail)/systemInfo.ssd_disk_total + ', ' + perimeter,
                    innerInfo: getfilesize(systemInfo.ssd_disk_total-systemInfo.ssd_disk_avail, true)+'/'+getfilesize(systemInfo.ssd_disk_total, true),
                },
                cpuInfo: {
                    info: String(systemInfo.cpu_usage * 3) + ",1000",
                    innerInfo: systemInfo.cpu_usage.toFixed(0) + '%',
                    stroke: systemInfo.cpu_usage.toFixed(0) >= 90 ?"#ED3360":"#1DBFA2",
                    dasharray: 2*systemInfo.cpu_usage.toFixed(0)+ ","+ perimeter
                },
                ramInfo: {
                    info: getfilesize(systemInfo.used_memory) + '/' + getfilesize(systemInfo.total_memory),
                    stroke: memoryNum >= 90 ?"#ED3360":"#1DBFA2",
                    innerInfo: memoryNum + '%',
                    dasharray: 2*memoryNum + ","+ perimeter
                },
                uploadInfo: {
                    info: getfilesize(systemInfo.transmitted_bytes, true) + '/S'
                },
                downloadInfo: {
                    info: getfilesize(systemInfo.received_bytes, true) + '/S'
                },
                systemInfo: systemInfo
            };
        }else{
            return {
                storageInfo: {
                    stroke: '#1DBFA2',
                    dasharray: 0,
                    innerInfo: 0,
                    percentageInfo: '0%',
                },
                cpuInfo: {
                    info: 0,
                    innerInfo: '0%',
                    stroke: "#1DBFA2",
                    dasharray: 0
                },
                ramInfo: {
                    info: '0',
                    stroke: "#1DBFA2",
                    innerInfo: '0%',
                    dasharray: 0
                },
                uploadInfo: {
                    info: '0KB/S'
                },
                downloadInfo: {
                    info: '0KB/S'
                }
            };
        }
        
    }

    async getDeviceInfo() {
        // Device静态信息
        let current_device_static_info_result = await this.m_util_service.get_device_static_info({ common: { flags: 0 } });
        if (!current_device_static_info_result.err) {
            current_device_static_info = current_device_static_info_result.unwrap().info;
        }
        console.origin.log('current_device_static_info', current_device_static_info)
        OWNER_ID = current_device_static_info.owner_id?.toString() || '';
        ZONE_ID = current_device_static_info.zone_id.object_id.toString();
        $('#zone_id').html(`( ID:${getSubStr(ZONE_ID)}  <i class="info_main_copy_svg info_main_copy_zone_svg">&nbsp;</i>)`);
        $('#owner_id').html(`DID: ${getSubStr(OWNER_ID)}`);
        const peopleR = (await ObjectUtil.getObject({ id: OWNER_ID, isReturnResult: true, flags: 1 })).object;
        this.handlerOodList(peopleR.object.body().unwrap().content().ood_list);
        console.origin.log('peopleR:', peopleR, peopleR.object.body().unwrap().content().ood_list, peopleR.object.icon() );
        $('.info_main_name').html(peopleR.object.name());
        if(peopleR.object.icon()){
            $('.info_main_portrait').attr('src', 'cyfs://o/'+peopleR.object.icon().object_id);
        }
    }

    async getArea (area_obj: cyfs.Area ) {
        // 区域代码
        let area_unwrap = area_obj;
        console.log('area_unwrap', area_unwrap)
        let others = 'Others';
        if (!area_unwrap.country && !area_unwrap.city) {
        } else {
            let area = area_obj.get_area_info('en');
            if (area) {
                if (area.country_name && area.city_name) {
                    return (area.country_name + ',' + area.state_name + ',' + area.city_name);
                }
            }
        }
        return others;
    }

    async handlerOodList (list: cyfs.DeviceId[]) {
        let oodItem = ``;
        for (let index = 0; index < list.length; index++) {
            const element = (await ObjectUtil.getObject({ id: list[index].object_id, isReturnResult: true })).object;
            OOD_ID_LIST.push(element.object_id);
            OOD_ID_STR_LIST.push(element.object_id.to_base_58());
            let isMain = index == 0 ? true : false;
            console.origin.log('---------element', element, element.object_id.to_base_58(), element.object.category())
            let status: boolean = false;
            if(isMain){
                MAIN_OOD_ID = element.object_id;
                status = await this.getOodStatus();
            }else{
                status = await this.getOodStatus(element.object_id);
            }
            if(index == list.length - 1){
                this.getDeviceList(MAIN_OOD_ID);
                setInterval(() => {
                    this.setIntervalSystemInfo();
                }, 300000);
            }
            let area = await this.getArea(element.object.desc().area().unwrap());
            let networkInfo = await this.getNetworkAccessInfo(element.object_id);
            let systemInfo = await this.getSystemInfo(element.object_id);
            let category:string = '';
            if(!element.object.category().err){
                let categoryR = element.object.category().unwrap();
                if(categoryR == cyfs.DeviceCategory.OOD){
                    category = 'OOD';
                }else if(categoryR == cyfs.DeviceCategory.VirtualOOD){
                    category = 'Virtual OOD';
                }
            }
            console.origin.log('---------systemInfo', systemInfo)
            oodItem = `<div class="info_ood_box overflow_h">
                            <div class="float_l info_ood_box_left">
                                <div class="info_ood_svg"></div>
                                <p class="info_ood_p"><span class="info_ood_name ood_name_ellipis">${element.object.name() || ''}</span> <span class="color_999">(${isMain?'Main':'Minor'} OOD)</span></p>
                                <p class="info_ood_p info_ood_padding_p">${getSubStr(element.object_id)} <i class="info_main_copy_svg info_main_copy_id_svg" data-id="${element.object_id}">&nbsp;</i></p>
                            </div>
                            <div class="float_r info_ood_box_right">
                                <h3 class="info_content_title" >Connection Status</h3>
                                <div class="info_connection_status">
                                    <div class="float_l">
                                        <p>
                                            <span>Status :</span>
                                            ${status?'<span class="color_287">Online</span>':'<span class="color_ed3">Not Online</span>'}
                                        </p>
                                        <p>
                                            <span>LAN IP :</span>
                                            <span>${networkInfo?.addressInfos[0]?.lan_ep.addr.ip || ''}</span>
                                        </p>
                                        <p>
                                            <span>IPV4 :</span>
                                            <span>NAT  Connect</span>
                                        </p>
                                        <p>
                                            <span><b class="sn_pn_text">PN :</b><i class="info_intro_svg info_intro_pn_svg">&nbsp;<i class="info_floating_pn_window">PN: Proxy Service.</i></i></span>
                                            <span>Not set</span>
                                        </p>
                                    </div>
                                    <div class="float_l">
                                        <p>
                                            <span>Region :</span>
                                            <span>${area}</span>
                                        </p>
                                        <p>
                                            <span>WAN IP :</span>
                                            <span>${networkInfo?.addressInfos[0]?.wan_ep.addr.ip || ''}</span>
                                        </p>
                                        <p>
                                            <span>OOD Type :</span>
                                            <span>${category}</span>
                                        </p>
                                        <p>
                                            <span><b class="sn_pn_text">SN :</b><i class="info_intro_svg info_intro_sn_svg">&nbsp;<i class="info_floating_sn_window">SN: Network Penetration Service.</i></i></span>
                                            <span>${networkInfo?.snInfo.sn}${networkInfo?.snInfo.isOnline?'<i class="sn_info_svg sn_online_svg">&nbsp;</i>':'<i class="sn_info_svg sn_notonline_svg">&nbsp;</i>'}</span>
                                        </p>
                                    </div>
                                    <div class="clear_both"></div>
                                </div>
                                <h3 class="info_content_title">Running Status</h3>
                                <div class="device_status_flexbox ${'running_status_box_' + index}">
                                    <div class="circular_graph item_flex_grow_1">
                                        <div class="circle_div">
                                            <svg xmlns="http://www.w3.org/200/svg" height="68" width="68">
                                                <circle cx="34" cy="34" r="31" fill="none" stroke="#E1E2E2" stroke-width="6" stroke-linecap="round"/>
                                                <circle class="circle_download" cx="34" cy="34" r="31" fill="none" stroke="${systemInfo.storageInfo.stroke}" stroke-width="6" stroke-dasharray="${systemInfo.storageInfo.dasharray}"/>
                                            </svg>
                                            <p class="circle_p"><span class="circle_span font_size12" style="color: ${systemInfo.cpuInfo.stroke}">${systemInfo.storageInfo.percentageInfo}</span></p>
                                        </div>
                                        <div class="circular_explain_box">
                                            <p class="circular_graph_p">Storage</p>
                                            <p >${systemInfo.storageInfo.innerInfo}</p>
                                        </div>
                                    </div> 
                                    <div class="circular_graph item_flex_grow_1">
                                        <div class="circle_div">
                                            <svg xmlns="http://www.w3.org/200/svg" height="68" width="68">
                                                <circle  cx="34" cy="34" r="31" fill="none" stroke="#E1E2E2" stroke-width="6" stroke-linecap="round"/>
                                                <circle class="circle_download" cx="34" cy="34" r="31" fill="none" stroke="${systemInfo.cpuInfo.stroke}" stroke-width="6" stroke-dasharray="${systemInfo.cpuInfo.dasharray}"/>
                                            </svg>
                                            <p class="circle_p"><span class="circle_span font_size16" style="color: ${systemInfo.cpuInfo.stroke}">${systemInfo.cpuInfo.innerInfo}</span></p>
                                        </div>
                                        <div>
                                            <p class="circular_graph_p">CPU</p>
                                        </div>
                                    </div> 
                                    <div class="circular_graph item_flex_grow_1">
                                        <div class="circle_div">
                                            <svg xmlns="http://www.w3.org/200/svg" height="68" width="68">
                                                <circle cx="34" cy="34" r="31" fill="none" stroke="#E1E2E2" stroke-width="6" stroke-linecap="round"/>
                                                <circle class="circle_download" cx="34" cy="34" r="31" fill="none" stroke="${systemInfo.ramInfo.stroke}" stroke-width="6" stroke-dasharray="${systemInfo.ramInfo.dasharray}"/>
                                            </svg>
                                            <p class="circle_p"><span class="circle_span font_size16"  style="color: ${systemInfo.cpuInfo.stroke}">${systemInfo.ramInfo.innerInfo}</span></p>
                                        </div>
                                        <div class="circular_explain_box">
                                            <p>RAM</p>
                                            <p >${systemInfo.ramInfo.info}</p>
                                        </div>
                                    </div> 
                                    <div class="circular_graph item_flex_grow_1">
                                        <div class="circle_div">
                                            <i class="upload_i"></i>
                                        </div>
                                        <div class="circular_explain_box">
                                            <p>Upload</p>
                                            <p >${systemInfo.uploadInfo.info}</p>
                                        </div>
                                    </div> 
                                    <div class="circular_graph item_flex_grow_1">
                                        <div class="circle_div">
                                            <i class="download_i"></i>
                                        </div>
                                        <div class="circular_explain_box">
                                            <p>Download</p>
                                            <p >${systemInfo.downloadInfo.info}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>`;
            $('.info_ood_list_box').append(oodItem);
        }
    }

    async getOodStatus(id?:cyfs.ObjectId) {
        // 连接状态信息
        let req = id ? { common: { flags: 0, target: id } } : { common: { flags: 0 } };
        let ood_status = await this.m_util_service.get_ood_status(req);
        if (!ood_status.err) {
            ood_status = ood_status.unwrap().status;
            console.log('ood_status:', ood_status);
            if (ood_status.last_ping_result == 0) {
                // 在线
                return true;
            } else {
                // 不在线
                return false;
            }
        }else{
            return false;
        }
        
    }

    async getNetworkAccessInfo(target?: cyfs.ObjectId) {
        let req = {
            common: {
                target: target,
                flags: 0
            },
        }
        let network_access_info_result = await this.m_util_service.get_network_access_info(req);
        let network_access_info;
        console.origin.log('network_access_info_result:', network_access_info_result);
        if (!network_access_info_result.err) {
            network_access_info = network_access_info_result.unwrap().info;
            console.origin.log('get_network_access_info:', network_access_info);
            let v4_info = network_access_info.v4;
            console.log('---------------v4_info', v4_info)
            let address_infos: cyfs.BdtNetworkAccessEndpoint[] = [];
            let first_address_info: cyfs.BdtNetworkAccessEndpoint | null = null;
            let sn_status: boolean = false;
            let snId: string = '';
            if (network_access_info?.sn) {
                snId = network_access_info.sn[0].sn.object_id.toString();
                sn_status = network_access_info.sn[0].sn_status == 'online' ?  true : false;
            }
            if (v4_info) {
                v4_info.forEach((element: cyfs.BdtNetworkAccessEndpoint) => {
                    console.origin.log('v4_element', element)
                    if (JSON.stringify(element.lan_ep) != "{}") {
                        if(element.access_type == 'wan'){
                            first_address_info = element;
                        } else {
                            address_infos.push(element);
                        }
                    }
                });
                if (first_address_info) {
                    address_infos.unshift(first_address_info);
                }
            }
            return {
                addressInfos:address_infos,
                snInfo: {
                    sn: snId,
                    isOnline: sn_status
                }
            };
        }else{
            return {
                addressInfos:[],
                snInfo: {
                    sn: '',
                    isOnline: false
                }
            };
        }
    }
}
const util = new Util();

function copyData (data:string) {
    $('#copy_textarea').text(data).show();
    $('#copy_textarea').select();
    document.execCommand('copy', false, '');
    $('#copy_textarea').hide();
    toast({
        message: LANGUAGESTYPE == 'zh'?"复制成功":'Copied successfully',
        time: 1500,
        type: 'success'
    });
}

$('.info_content_advanced_title').on('click', (event) => {
    let advancedDisplay = $('.info_content_advanced_box').css('display');
    if(advancedDisplay == 'block'){
        $('.info_content_advanced_box').css('display', 'none');
        $('.info_advanced_icon').addClass('info_advanced_open_icon').removeClass('info_advanced_swallow_icon');
        $('.info_left_nav_box').css('height', '100%');
    }else{
        $('.info_content_advanced_box').css('display', 'block');
        $('.info_advanced_icon').addClass('info_advanced_swallow_icon').removeClass('info_advanced_open_icon');
        $('.info_left_nav_box').css('height', $('body').css('height'));
    }
})

$('.info_main_copy_owner_svg').on('click', function () {
    copyData(OWNER_ID);
})

$('.info_zone_title_id').on('click', ".info_main_copy_zone_svg", function () {
    copyData(ZONE_ID);
})

$('.info_list_container').on('click', ".info_main_copy_id_svg", function () {
    let id = $(this).attr("data-id") || '';
    copyData(id);
})

$('.info_main_introduce_svg').on('mouseenter', function () {
    $('.info_floating_window').css('display', 'block');
})

$('.info_main_introduce_svg').on('mouseleave', function () {
    $('.info_floating_window').css('display', 'none');
})

$('.header_box_icon').on('click', function () {
    window.location.href = 'cyfs://static/browser.html';
})

$('.info_ood_list_box, .info_device_list_box').on('mouseenter', ".info_intro_pn_svg, .info_intro_sn_svg", function () {
    $(this).children().css('display', 'block');
})

$('.info_ood_list_box, .info_device_list_box').on('mouseleave', ".info_intro_pn_svg, .info_intro_sn_svg", function () {
    $(this).children().css('display', 'none');
})