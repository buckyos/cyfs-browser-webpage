
import "../../css/m_main.css"
import * as cyfs from '../../cyfs_sdk/cyfs.d'
import $ from 'jquery'
let QRCode = require('qrcode')
import { toast } from '../lib/toast.min'
import { ObjectUtil, getSubStr, hasPC, castToLocalUnit } from '../lib/util'

let ISPC = hasPC();
let isBindInterval: NodeJS.Timeout | null = null;
let isBind = false;
function isUnbind(isActivation: boolean) {
    let url = 'http://127.0.0.1:1321/check';
    let ajax = new XMLHttpRequest();
    ajax.open('get', url, true);
    ajax.send();
    ajax.onreadystatechange = function () {
        if (ajax.readyState == 4 && ajax.status == 200) {
            // console.log('JSON.parse(ajax.responseText)', JSON.parse(ajax.responseText))
            const result = JSON.parse(ajax.responseText);
            if (!result.activation) {
                document.getElementById('nft_list')!.style.display = 'none';
                if (isActivation) {
                    // 未绑定
                    isBind = false;
                    document.getElementById('people_name')?.innerHTML == '点击绑定';
                    document.getElementById('people_name2')?.innerHTML == '请绑定后查看';
                    document.getElementById('people_name3')!.innerHTML = '请绑定后查看';
                    document.getElementById('unsignin_app')!.style.display = 'block';
                    document.getElementById('signin_ul')!.style.display = 'none';
                    document.getElementById('unsignin_input')!.classList.add('unsignin_input');
                    $('#unsignin_input').attr('disabled', 'disabled');
                    // document.getElementById("unsignin_input").placeholder = '输入对象ID，查询zone内对象';
                    let localIps = result.access_info.addrs;
                    let access_token = result.access_info.access_token?result.access_info.access_token:'';
                    let params = {
                        "flag": "cyfs",
                        "type": "bindDevice",
                        "data": {
                            "type": 2,
                            "ip": localIps,
                            "access_token": access_token
                        }
                    }
                    document.getElementById("scan_box")!.innerHTML = "";
                    QRCode.toCanvas(document.getElementById('scan_box'), JSON.stringify(params), {
                        errorCorrectionLevel: 'L',
                        width: 100,
                        height: 100,
                        margin: 0
                    });
                    isBindInterval = setInterval(() => {
                        isUnbind(false);
                    }, 2000);
                }
            } else {
                // 已绑定
                isBind = true;
                if (isBindInterval) {
                    clearInterval(isBindInterval);
                }
                if (!isActivation) {
                    toast({
                        message: "绑定成功",
                        time: 1500,
                        type: 'success'
                    });
                }
                document.getElementById('unsignin_app')!.style.display = 'none';
                document.getElementById('signin_ul')!.style.display = 'flex';
                document.getElementById('unsignin_input')!.classList.remove('unsignin_input');
                $('#unsignin_input').removeAttr("disabled");
                util.getDeviceInfo();
                util.getAppList();
            }
        }
    }
};
let NFTLIST: { amount: number, id: string, lastestAmount: number }[] = [];
let OBJECTSTORAGE = 0;
let DATASTORAGE = 0;

// 搜索
function searchTxt() {
    if (isBind) {
        let val = $('#unsignin_input')!.val()!;
        if (ISPC) {
            window.open("cyfs://static/object_browser/objects.html?id=" + val);
        } else {
            window.location.href = "cyfs://static/mobile/objects.html?id=" + val;
        }
    }
}
if (ISPC) {
    setInterval(() => { util.getAmoutList() }, 60000);
}
setInterval(() => { util.getNocInfo(false) }, 300000);
function showThisBox(name: string) {
    let isShow = document.getElementById(name)!.style.display;
    if (!isShow || isShow == 'none') {
        let boxs = document.querySelectorAll('.show-box') as NodeListOf<HTMLElement>;
        for (let i = 0; i < boxs.length; i++) {
            boxs[i].style.display = 'none';
        }
        document.getElementById(name)!.style.display = 'block';
    } else {
        document.getElementById(name)!.style.display = 'none';
    }
}
class Util {
    m_sharedStatck: cyfs.SharedObjectStack;
    m_util_service: cyfs.UtilRequestor;
    m_router: cyfs.NONRequestor;
    meta_client: cyfs.MetaClient;
    constructor() {
        this.m_sharedStatck = cyfs.SharedObjectStack.open_runtime();
        this.m_util_service = this.m_sharedStatck.util();
        this.m_router = this.m_sharedStatck.non_service();
        // 空参数或'test'为测试链，传'dev'为正式链
        this.meta_client = cyfs.create_meta_client();
    }

    async getDeviceInfo() {
        // Device静态信息
        let current_device_static_info = await this.m_util_service.get_device_static_info({ common: { flags: 0 } });
        if (!current_device_static_info.err) {
            current_device_static_info = current_device_static_info.unwrap().info;
        }
        console.info('current_device_static_info:', current_device_static_info);
        document.getElementById('people_name3')!.innerHTML = current_device_static_info.device.name();
        document.getElementById('owner_id')!.innerHTML = 'PeopleID:' + getSubStr(current_device_static_info.owner_id.toString());
        if (ISPC) {
            document.getElementById('device_id')!.innerHTML = `DeviceID:<a target="_blank" href="cyfs://static/info.html">${getSubStr(current_device_static_info.device_id.object_id.toString())}</a>`;
            document.getElementById('ood_id')!.innerHTML = `OODID:<a target="_blank" href="cyfs://static/info.html?owner">${getSubStr(current_device_static_info.ood_device_id.object_id.toString())}</a>`;
        } else {
            document.getElementById('device_id')!.innerHTML = `DeviceID:<a href="cyfs://static/mobile/info.html">${getSubStr(current_device_static_info.device_id.object_id.toString())}</a>`;
            document.getElementById('ood_id')!.innerHTML = `OODID:<a href="cyfs://static/mobile/info.html?owner">${getSubStr(current_device_static_info.ood_device_id.object_id.toString())}</a>`;
        }
        document.getElementById("scan_box")!.innerHTML = "";
        QRCode.toCanvas(document.getElementById('scan_box'), current_device_static_info.owner_id.toString(), {
            errorCorrectionLevel: 'L',
            width: 100,
            height: 100,
            margin: 0
        });

        // 打赏列表
        if (ISPC) {
            util.getAmoutList()
        }
        // NOC统计信息
        let device_noc = await this.m_util_service.get_noc_info({ common: { flags: 0, target: current_device_static_info.device_id.object_id } });
        if (!device_noc.err) {
            device_noc = device_noc.unwrap().stat;
        }
        console.info('device_noc', device_noc);
        document.getElementById('device_object')!.innerHTML = '对象缓存' + device_noc.count;
        document.getElementById('device_data')!.innerHTML = '数据缓存' + device_noc.storage_size;
        util.getNocInfo(true);
        document.getElementById('people_name')!.innerHTML = document.getElementById('people_name2')!.innerHTML = (await ObjectUtil.getObject({ id: current_device_static_info.owner_id, isReturnResult: true })).object.object.name();
    }

    async getOodStatus() {
        // OOD连接状态信息
        let ood_status = await this.m_util_service.get_ood_status({ common: { flags: 0 } });
        if (!ood_status.err) {
            ood_status = ood_status.unwrap().status;
            // console.info('ood_status:', ood_status);
            let router_svg = document.getElementById('router_svg')!;
            router_svg.classList.forEach(className => {
                if (className != 'header-right-box-i') {
                    router_svg.classList.remove(className)
                }
            })

            // ood_status.ping_avg_during 微秒
            document.getElementById('delayed')!.innerHTML = ood_status.ping_avg_during ? parseInt((ood_status.ping_avg_during / 1000).toString()) + 'ms' : 0 + 'ms';
            if (ood_status.cont_fail_count < 3) {
                const PING_LEVEL_GOOD = 500 * 1000;
                const PING_LEVEL_NORMAL = 1000 * 1000;
                if (ood_status.network == 'Intranet') {
                    if (ood_status.ping_avg_during <= PING_LEVEL_GOOD) {
                        // 强
                        document.getElementById('id_ood_online')!.innerHTML = '强';
                        router_svg.classList.add('router_intranet_strong_svg');
                    } else if (ood_status.ping_avg_during <= PING_LEVEL_NORMAL) {
                        // 中
                        document.getElementById('id_ood_online')!.innerHTML = '中';
                        router_svg.classList.add('router_intranet_middle_svg');
                    } else {
                        // 弱
                        document.getElementById('id_ood_online')!.innerHTML = '弱';
                        router_svg.classList.add('router_intranet_weak_svg');
                    }
                } else {
                    if (ood_status.ping_avg_during <= PING_LEVEL_GOOD) {
                        // 强
                        document.getElementById('id_ood_online')!.innerHTML = '强';
                        router_svg.classList.add('router_extranet_strong_svg');
                    } else if (ood_status.ping_avg_during <= PING_LEVEL_NORMAL) {
                        // 中
                        document.getElementById('id_ood_online')!.innerHTML = '中';
                        router_svg.classList.add('router_extranet_middle_svg');
                    } else {
                        // 弱
                        document.getElementById('id_ood_online')!.innerHTML = '弱';
                        router_svg.classList.add('router_extranet_weak_svg');
                    }
                }
            } else {
                document.getElementById('id_ood_online')!.innerHTML = '断开';
                router_svg.classList.add('router-offline-svg');
            }
        }
    }

    async getNocInfo(isFirst: boolean) {
        util.getOodStatus();
        let current_device_static_info = await this.m_util_service.get_device_static_info({ common: { flags: 0 } });
        if (!current_device_static_info.err) {
            current_device_static_info = current_device_static_info.unwrap().info;
        }
        let ood_noc = await this.m_util_service.get_noc_info({ common: { flags: 0, target: current_device_static_info.ood_device_id.object_id } });
        if (!ood_noc.err) {
            ood_noc = ood_noc.unwrap().stat;
        }
        // console.info('ood_noc', ood_noc);
        if (isFirst) {
            OBJECTSTORAGE = ood_noc.count;
            DATASTORAGE = ood_noc.storage_size;
        }
        document.getElementById('ood_object')!.innerHTML = '对象存储数' + ood_noc.count + '，新增' + (ood_noc.count - OBJECTSTORAGE);
        document.getElementById('ood_data')!.innerHTML = '数据存储数' + ood_noc.storage_size + '，新增' + (ood_noc.storage_size - DATASTORAGE);
        OBJECTSTORAGE = ood_noc.count;
        DATASTORAGE = ood_noc.storage_size;
    }

    async getAmoutList() {
        let current_device_static_info = await this.m_util_service.get_device_static_info({ common: { flags: 0 } });
        if (!current_device_static_info.err) {
            current_device_static_info = current_device_static_info.unwrap().info;
        }
        let nft_list: { amount: number, id: string, lastestAmount: number }[] = [];
        const nft_id_list = cyfs.NFTList.create(current_device_static_info.owner_id);
        let objectId = nft_id_list.desc().calculate_id();
        let r = await ObjectUtil.getObject({ id: objectId, decoder: cyfs.NFTListDecoder.create() });
        // console.info('rrrrrrrrrrrrrrrrrr', r)
        if (r.err) {
        } else {
            let [list_ret,] = r;
            let nft_id_list = list_ret.obj_list();
            // console.info('nft_id_list:', list_ret.obj_list());
            if (nft_id_list.size) {
                document.getElementById('nft_list')!.style.display = 'block';
                // console.info('nft_id_list:', nft_id_list);
                for (let [id, comment] of nft_id_list) {
                    const idStr = id.to_string();
                    let obj = NFTLIST.find(o => o.id === idStr);
                    // console.info('idStr:', idStr, obj);
                    let amount = 0;
                    let amountResult = await this.meta_client.getFileRewardAmount(idStr);
                    if (!amountResult.err) {
                        amount = amountResult.result;
                    }
                    // console.info('amount:', amount);
                    if (obj) {
                        let record = 0;
                        if (amount > obj.amount && amount > obj.lastestAmount) {
                            record = amount - obj.lastestAmount;
                            nft_list.push({ amount: record, id: idStr, lastestAmount: amount })
                        }
                    } else {
                        nft_list.push({ amount: amount, id: idStr, lastestAmount: amount })
                    }
                }
                NFTLIST = nft_list.concat(NFTLIST);
            } else {
                document.getElementById('nft_list')!.style.display = 'none';
            }
        }
        // console.info('NFTLIST:', NFTLIST)
        util.renderingNft(NFTLIST.slice(0, 10));
    }

    renderingNft(nft_list: { amount: number, id: string, lastestAmount: number }[]) {
        let nftHtml = '';
        nft_list.forEach((nft: { amount: number, id: string, lastestAmount: number }, index: number) => {
            console.log('nft', nft)
            if (ISPC) {
                nftHtml += `<li>
                                    <a href="cyfs://static/show.html?${nft.id}" target="_blank">${getSubStr(nft.id)}</a>收到打赏，被打赏总额:${castToLocalUnit(nft.amount)}ECC
                                </li>`;
            } else {
                nftHtml += `<li>
                                    <a href="cyfs://static/mobile/show.html?${nft.id}">${getSubStr(nft.id)}</a>收到打赏，被打赏总额:${castToLocalUnit(nft.amount)}ECC
                                </li>`;
            }
        })
        document.getElementById('reward_box_ul')!.innerHTML = nftHtml;
        if (nft_list[0]) {
            document.getElementById('nft_list')!.style.display = 'block';
            document.getElementById('last_reward')!.innerHTML = `${getSubStr(nft_list[0].id)}收到打赏，被打赏总额:${castToLocalUnit(nft_list[0].amount)}ECC`;
        } else {
            document.getElementById('nft_list')!.style.display = 'none';
        }
    }

    async getAllAppListFun() {
        let result = await this.m_util_service.get_device({ common: { flags: 0 } });
        if (!result.err) {
            result = result.unwrap()
        }
        let current_device = result.device
        console.info('current_device: ', current_device)
        let owner = current_device.desc().owner().unwrap();
        let app_store_list_id = cyfs.AppStoreList.create(owner).desc().calculate_id();
        let ret = await ObjectUtil.getObject({ id: app_store_list_id, decoder: cyfs.AppStoreListDecoder.create() });
        if (ret.err) {
            if (ret.val.code != cyfs.BuckyErrorCode.NotFound) {
                toast({
                    message: "获取列表失败",
                    time: 1500,
                    type: 'warn'
                });
            }
            return ret;
        } else {
            let [r,] = ret;
            return r;
        }
    }

    // 获取app信息
    async showApp(id: cyfs.ObjectId) {
        let r = {};
        let ret = await ObjectUtil.getObject({ id: id, decoder: cyfs.DecAppDecoder.create() });
        if (ret.err) {
            toast({
                message: "获取信息失败",
                time: 1500,
                type: 'warn'
            });
        } else {
            [r,] = ret;
        }
        return r;
    }

    // 已安装列表渲染
    async getAppList() {
        let installHtml = "";
        let appImgSrc = '';
        if (!ISPC) {
            appImgSrc = '.';
        }
        installHtml += `<li>
                                <div class="app-content fixed-app click-app-content" data-id="9tGpLNnQYZnorAEiV85scsixeEWUKKcDKwaPX5ZSUuUU">
                                    <img class="fixed-app-img" src="${appImgSrc}./img/app_miner.svg" alt="">
                                </div>
                                <p class="app-name">享存DSG Miner</p>
                            </li>
                            <li>
                                <div class="app-content fixed-app click-app-content" data-id="9tGpLNnasLF2TTDdSYBv4Cc3h49jZLZRhujkRKjxaMzU">
                                    <img class="fixed-app-img" src="${appImgSrc}./img/app_dsg.svg" alt="">
                                </div>
                                <p class="app-name">享存客户端</p>
                            </li>
                            <li>
                                <div class="app-content fixed-app click-app-content" data-id="9tGpLNnBYrgMNLet1wgFjBZhTUeUgLwML3nFhEvKkLdM">
                                    <img class="fixed-app-img" src="${appImgSrc}./img/app_drive.svg" alt="">
                                </div>
                                <p class="app-name">CYFS Drive</p>
                            </li>`;
        if (ISPC) {
            const list_ret = await util.getAppListFunc();

            if (list_ret.err) {
                toast({
                    message: "获取APP列表失败",
                    time: 1500,
                    type: 'warn'
                });
            } else {
                console.info('已安装列表获取:', list_ret.app_list())
                // for (const [appid, status] of list_ret.app_list()) {
                //     let app = await util.showApp(appid.object_id, false);
                //     let appImg = './img/appmanager/blank.svg';
                //     if(!ISPC){
                //         appImg = '../img/appmanager/blank.svg';
                //     }
                //     if (app.app_icon) {
                //         appImg = app.app_icon;
                //     }
                //     installHtml += `<li>
                //                     <div class="app-content click-app-content" data-id="${appid.object_id.to_base_58()}">
                //                         <img src="${appImg}" alt="">
                //                     </div>
                //                     <p class="app-name">${app.name()}</p>
                //                 </li>`;
                // }
                let imgSrc = '';
                if (ISPC) {
                    imgSrc = './img/last-child-li.svg';
                } else {
                    imgSrc = '../img/last-child-li.svg';
                }
                installHtml += `<li class="last-child-li">
                                        <div class="app-content manager_app" id="manager_app">
                                            <img src=${imgSrc} alt="">
                                        </div>
                                        <p class="app-name">管理App</p>
                                    </li>`;
            }
        }
        document.getElementById('signin_ul')!.innerHTML = installHtml;
    }

    // 获取appstatus
    async getAppStatus(app_id: string | cyfs.DecAppId) {
        let app_id_string: cyfs.DecAppId;
        if (typeof (app_id) === 'string') {
            let idRet = cyfs.ObjectId.from_base_58(app_id);
            console.info('idRet', idRet)
            if (idRet.err) {
                alert('appid错误');
                return;
            } else {
                app_id_string = idRet.unwrap();
            }
        } else {
            app_id_string = app_id;
        }
        await this.m_sharedStatck.online();
        let manager = new cyfs.AppManager(this.m_sharedStatck);
        let get_status = await manager.get_app_local_status(app_id_string);
        console.info('------get_status', get_status)
        return get_status;
    }

    // 已安装列表获取
    async getAppListFunc() {
        let result = await this.m_util_service.get_device({ common: { flags: 0 } });
        if (!result.err) {
            result = result.unwrap()
        }
        let current_device = result.device
        console.info('current_device: ', current_device)
        let owner = current_device.desc().owner().unwrap();
        console.info('owner: ', owner, owner.to_base_58())
        let objectId = cyfs.AppList.create(owner, '', 'app')
        let AppListId = objectId.desc().calculate_id();
        console.log('AppListId: ', AppListId)
        let r = await ObjectUtil.getObject({ id: AppListId, decoder: cyfs.AppListDecoder.create() });
        if (r.err) {
            return r;
        } else {
            let [list_ret,] = r;
            return list_ret;
        }
    }
}
const util = new Util();
isUnbind(true);


// auto add event
// 管理APP
$('#signin_ul').on('click', ' .manager_app', () => {
    if (ISPC) {
        window.open("cyfs://static/appmanager.html");
    } else {
        window.location.href = "cyfs://static/mobile/appmanager.html";
    }
})

$('#signin_ul').on('click', ' .click-app-content', async function () {
    if (isBind) {
        let id = $(this).attr('data-id');
        if (!id) {
            return;
        }
        let appStatus = await util.getAppStatus(id);
        if (appStatus.err) {
            alert('应用正在初始化....');
        } else {
            let status = appStatus.unwrap();
            if (status.webdir()) {
                if (ISPC) {
                    window.open(`cyfs://o/${status.webdir().to_base_58()}/index.html`);
                } else {
                    window.location.href = `cyfs://o/${status.webdir().to_base_58()}/index.html`;
                }
            } else {
                alert('应用正在初始化....');
            }
        }
    } else {
        alert('请绑定后使用');
    }
})

$('.people-svg, .app_click').on('click', (event) => {
    showThisBox('user_content')
})

$('#people_name').on('click', (event) => {
    showThisBox('user_content')
})

$('.reward-svg').on('click', (event) => {
    showThisBox('reward_box')
})

$('#last_reward').on('click', (event) => {
    showThisBox('reward_box')
})

$('.pc-svg').on('click', (event) => {
    showThisBox('device_content')
})

$('#router_svg').on('click', (event) => {
    showThisBox('ood_content')
})

$('.browser-search-svg').on('click', (event) => {
    searchTxt()
})
undefined
$('#unsignin_input').on('keydown', (event) => {
    if (event.keyCode == 13) { searchTxt() }
})



 