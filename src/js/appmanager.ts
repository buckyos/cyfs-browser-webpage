import * as cyfs from '../cyfs_sdk/cyfs'
import { ObjectUtil, hasPC } from './lib/util'

var ISPC = hasPC();
let APPLIST: { app_id: cyfs.DecAppId, app_name: string, app_icon: string, fidArray: { fid: cyfs.ObjectId, version: string }[], owner: cyfs.ObjectId }[] = [];
let ISSTATUS = false;
let CURRENTAPPID = '';
let DELETEID = '';
let installAppList: { app_id: cyfs.DecAppId, app_name: string, app_icon: string, fidArray: { fid: cyfs.ObjectId, version: string }[], owner: cyfs.ObjectId, app_version: string }[] = [];

function openCover() {
    let coverBox = document.getElementById('cover_box')!;
    coverBox.style.display = 'block';
}

$("#store_list").on("click", ".refresh_span", async function () {
    let id = $(this).attr("data-appid");
    let index = Number($(this).attr("data-key"));
    let owner = $(this).attr("data-owner");
    console.log('id, index, owner', id, index, owner)
    let appVersions = "";
    if (id && index) {
        let app = await objectManager.showApp(id, true);
        if (app) {
            console.log('app.fidArray', app.fidArray)
            app.fidArray.forEach((element: { fid: cyfs.ObjectId, version: string }) => {
                appVersions += `<option value="${element.version}">${element.version}</option>`;
            });
            $('.appVersionBox').eq(index).val(appVersions);
        }
    }
})

function closeCover() {
    let coverBox = document.getElementById('cover_box')!;
    coverBox.style.display = 'none';
    $('#cover_input').val('');
}

function openRemoveCover() {
    let coverBox = document.getElementById('remove_box')!;
    coverBox.style.display = 'block';
}

function removeAppConfirm() {
    $('.installing_text').html('卸载中......');
    $('.install_box').css('display', 'block');
    objectManager.removeApp(removerId);
    closeRemoveCover();
}

function closeRemoveCover() {
    let coverBox = document.getElementById('remove_box')!;
    coverBox.style.display = 'none';
}

class ObjectManager {
    m_sharedStatck: cyfs.SharedCyfsStack;
    m_util_service: cyfs.UtilRequestor;
    m_router: cyfs.NONRequestor;
    constructor() {
        this.m_sharedStatck = cyfs.SharedCyfsStack.open_runtime();
        this.m_router = this.m_sharedStatck.non_service();
        this.m_util_service = this.m_sharedStatck.util();
    }

    async putObj(obj: cyfs.DecApp | cyfs.PutApp) {
        const router = this.m_router;
        let buf_len = obj.raw_measure().unwrap();
        let buf = new Uint8Array(buf_len);
        obj.raw_encode(buf);
        let r = await router.put_object({
            object: new cyfs.NONObjectInfo(obj.desc().calculate_id(), buf),
            common: {
                level: cyfs.NONAPILevel.Router,
                flags: 0
            }
        });
        console.log('--------r', r)
        if (r.err && r.val.code != cyfs.BuckyErrorCode.Ignored) {
            return r;
        } else {
            return r;
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
            $('.install_content_box').css('display', 'none');
            $('#store_list').css('display', 'none');
            $('.unconnect_ood').css('display', 'block');
        }
    }

    // 已安装列表渲染
    async getAppList(name?: string) {
        const list_ret = await objectManager.getAppListFunc();
        let installList = document.getElementById('install_list')!;
        let installHtml = "";
        installAppList = [];
        let otherHtml = ISPC ? 'target="_blank"' : '';
        if (list_ret.err || !list_ret.app_list().size) {
            installList.innerHTML = '无';
        } else {
            console.log('已安装列表获取:', list_ret.app_list())
            let i = 0;
            for (const [appid, status] of list_ret.app_list()) {
                console.log('appid.object_id, status:', appid.object_id, status, status.status())
                let app = await objectManager.showApp(appid.object_id, false);
                let get_app_status = await objectManager.getAppStatus(appid.object_id)
                console.log('get_app_status', get_app_status, get_app_status.webdir())
                let app_status = get_app_status.status();
                let appImg = '../img/appmanager/blank.png';
                if (ISPC) {
                    appImg = './img/appmanager/blank.png';
                }
                if (app.app_icon) {
                    appImg = app.app_icon;
                }
                if ((name && app.app_name.indexOf(name) > -1) || !name) {
                    console.log('------------app_status', app.app_name, app_status);
                    let run_disabled = null;
                    let stop_disabled = null;
                    let uninstall_disabled = null;
                    let open_dir = '';
                    let appStr = "";
                    let appMobileStr = "";
                    if (app_status == 0) {
                        stop_disabled = 'disabled';
                        appStr = 'DecService已停止';
                        appMobileStr = 'Service已停止';
                    } else if (app_status == 1) {
                        appStr = '待安装';
                        appMobileStr = '待安装';
                    } else if (app_status == 2) {
                        appStr = '正在安装';
                        appMobileStr = '正在安装';
                    } else if (app_status == 3) {
                        appStr = 'DecService正在运行';
                        appMobileStr = 'Service正在运行';
                        run_disabled = 'disabled';
                        if (get_app_status.webdir()) {
                            console.log('get_app_status.webdir().to_base_58()', get_app_status.webdir().to_base_58())
                            open_dir = `<a class="webdir_open_i" href="cyfs://a/${appid.object_id}/index.html" ${otherHtml} ></a>`;
                        }
                    } else if (app_status == 4) {
                        appStr = '安装失败';
                        appMobileStr = '安装失败';
                        run_disabled = 'disabled';
                        stop_disabled = 'disabled';
                    } else if (app_status == 5) {
                        appStr = 'DecService运行失败';
                        appMobileStr = 'Service运行失败';
                        stop_disabled = 'disabled';
                    } else if (app_status == 6) {
                        appStr = '该应用不包含DecService';
                        appMobileStr = '该应用不包含Service';
                        run_disabled = 'disabled';
                        stop_disabled = 'disabled';
                        if (get_app_status.webdir()) {
                            console.log('get_app_status.webdir().to_base_58()', get_app_status.webdir().to_base_58())
                            open_dir = `<a class="webdir_open_i" href="cyfs://a/${appid.object_id}/index.html" ${otherHtml}></a>`;
                        }
                    }
                    let vesionHtml = '';
                    if (ISPC) {
                        vesionHtml = `<p class="version_p" id="install_ver">v${status.version()}<span style="float:right">${appStr}</span></p>`;
                    } else {
                        vesionHtml = `<p class="version_p" id="install_ver">v${status.version()}</p>
                                          <p class="version_p">${appMobileStr}</p>`;
                    }
                    app.app_version = status.version();
                    installAppList.push(app)
                    console.log('-------------installAppList', installAppList)
                    installHtml += `<li>
                                            <h4 class="flex_box_h4">${app.app_name}</h4>
                                            <div class="img_box">
                                                ${open_dir}
                                                <img src="${appImg}" alt="">
                                            </div>
                                            <div class="flex_center">
                                                ${vesionHtml}
                                            </div>
                                            <div class="install_btn_box">
                                                <button class="run_app_btn" ${run_disabled} data-appid="${appid.object_id}" data-version="${status.version()}" data-isrun="true" >运行</button>
                                                <button class="run_app_btn" ${stop_disabled} data-appid="${appid.object_id}" data-version="${status.version()}" data-isrun="false">停止</button>
                                                <button class="refresh_btn" data-appid="${appid.object_id}" data-key="${i}">刷新版本</button>
                                                <button class="install_remove_btn" ${uninstall_disabled} data-appid="${appid.object_id}" >卸载</button>
                                            </div>
                                        </li>`;
                    i++;
                }
            }
            installList.innerHTML = installHtml;
        }

    }

    // 已安装列表获取
    async getAppListFunc() {
        let result = await this.m_util_service.get_device({ common: { flags: 0 } });
        if (!result.err) {
            result = result.unwrap()
        }
        let current_device = result.device
        console.log('current_device: ', current_device)
        let owner = current_device.desc().owner().unwrap();
        console.log('owner: ', owner, owner.to_base_58())
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

    // 已安装列表监听
    async appListListener() {
        const eventProcessor = new ObjectEventProcessor();
        await this.m_sharedStatck.router_handlers().add_put_object_handler(
            cyfs.RouterHandlerChain.PostNOC,
            "browser-buildinpage-applist-update-event",
            -1,
            `obj_type == ${cyfs.CoreObjectType.AppList}`,
            cyfs.RouterHandlerAction.Pass,
            cyfs.Some(eventProcessor)
        );
    }

    // 已安装列表状态监听
    async appStatusListener() {
        const eventProcessor = new ObjectStautsEventProcessor();
        await this.m_sharedStatck.router_handlers().add_put_object_handler(
            cyfs.RouterHandlerChain.PostNOC,
            "browser-buildinpage-applist-status-update-event",
            -1,
            `obj_type == ${cyfs.CoreObjectType.AppLocalStatus}`,
            cyfs.RouterHandlerAction.Pass,
            cyfs.Some(eventProcessor)
        );
    }

    async getAppStatus(app_id: cyfs.DecAppId) {
        await this.m_sharedStatck.online();
        let manager = new cyfs.AppManager(this.m_sharedStatck);
        let get_status = await manager.get_app_local_status(app_id);
        if (get_status.err) {
            return get_status;
        } else {
            let status = get_status.unwrap();
            return status;
        }
    }

    async showApp(id: cyfs.ObjectId | string, isRefresh: boolean) {
        let r;
        let ret = await ObjectUtil.getObject({ id: id, decoder: new cyfs.DecAppDecoder });
        if (ret.err) {
            alert('失败');
        } else {
            [r,] = ret;
        }

        if (isRefresh) {
            let owner = r.desc().owner().unwrap();
            let newRet = await ObjectUtil.getObject({ id: id, decoder: new cyfs.DecAppDecoder, flags: 1, target: owner });
            if (newRet.err) {
                alert('刷新失败');
            } else {
                [r,] = newRet;
                let putResult = await objectManager.putObj(r);
                if (putResult.err && putResult.val.code != cyfs.BuckyErrorCode.Ignored) {
                    alert('刷新失败');
                }
            }
        }

        if (r.err) {
            // return "";
            console.log('showApp--r', r)
            return r;
        } else {
            let app = r;
            let appObj: { app_id: cyfs.ObjectId | string, app_name: string, app_icon: string, fidArray: { fid: cyfs.ObjectId, version: string }[], owner: cyfs.ObjectId } = {
                app_id: id,
                app_name: '',
                app_icon: '',
                fidArray: [],
                owner: app.desc().owner().unwrap()
            };
            // 取app的名字和图标，icon可能为undefined
            appObj.app_name = app.name();
            appObj.app_icon = app.icon();
            // 遍历app的版本列表
            for (const [ver, fid] of app.source().to((k: String) => k, (v: cyfs.ObjectId) => v)) {
                let app_versions: { fid: cyfs.ObjectId, version: string } = {
                    fid: fid,
                    version: ver.s
                }
                appObj.fidArray.push(app_versions);
            }
            return appObj;
        }

    }

    // 商店列表
    async getAllAppList(name?: string) {
        let r = await objectManager.getAllAppListFun();
        let storeListDom = document.getElementById('store_list')!;
        if (r.err) {
            storeListDom.innerHTML = "无";
        } else {
            let storeList: cyfs.DecAppId[] = r.app_list();
            if (storeList?.length) {
                console.log('--------------------------rstore_list', storeList)
                let storeHtml = "";
                let j = 0;
                for (let i = 0; i < storeList.length; i++) {
                    if (storeList[i]) {
                        console.log('--------------------element', i, storeList[i], storeList[i].object_id)
                        let app = await objectManager.showApp(storeList[i].object_id, false);
                        if (!app) {
                            return;
                        }
                        APPLIST.push(app);
                        console.log('------------------------------app', app)
                        let appVersions = "";
                        let appNum = 0;
                        if (app) {
                            app.fidArray.forEach((element: { fid: cyfs.ObjectId, version: string }) => {
                                appVersions += `<option value="${element.version}">${element.version}</option>`;
                                appNum++;
                            });
                        }
                        let appImg = '../img/appmanager/blank.png';
                        if (ISPC) {
                            appImg = './img/appmanager/blank.png';
                        }
                        if (app.app_icon) {
                            appImg = app.app_icon;
                        }
                        if ((name && app.app_name.indexOf(name) > -1) || !name) {
                            storeHtml += `<li>
                                            <h4 class="flex_box_h4">${app.app_name}</h4>
                                            <div class="img_box">
                                                <img src="${appImg}" alt="">
                                            </div>
                                            <div class="flex_center">
                                                <div class="select_div">
                                                    <select class="select_box" class="appVersionBox" name="appVersionBox">
                                                        ${appVersions}
                                                    </select>
                                                </div>
                                                <i class="refresh_icon"></i>
                                                <span class="refresh_span" data-appid="${app.app_id}" data-key="${j}" data-owner="${app.owner}">刷新</span>
                                            </div>
                                            <p style="text-align: center;margin-top: 16px;">
                                                <button class="install_btn" data-appid="${app.app_id}" data-key="${j}">安装</button>
                                            </p>
                                        </li>`;
                            j++;
                        }
                    }
                    storeListDom.innerHTML = storeHtml;
                }
            } else {
                storeListDom.innerHTML = "无";
            }
        }

    }

    async getAllAppListFun() {
        let result = await this.m_util_service.get_device({ common: { flags: 0 } });
        if (!result.err) {
            result = result.unwrap()
        }
        let current_device = result.device
        console.log('current_device: ', current_device)
        let owner = current_device.desc().owner().unwrap();
        let app_store_list_id = cyfs.AppStoreList.create(owner).desc().calculate_id();

        let ret = await ObjectUtil.getObject({ id: app_store_list_id, decoder: cyfs.AppStoreListDecoder.create() });
        if (ret.err) {
            return ret;
        } else {
            let [r,] = ret;
            return r;
        }

    }

    // 商店列表监听
    async appStoreListListener() {
        const eventProcessor = new ObjectStoreEventProcessor();
        await this.m_sharedStatck.router_handlers().add_put_object_handler(
            cyfs.RouterHandlerChain.PostNOC,
            "browser-buildinpage-appstorelist-update-event",
            -1,
            `obj_type == ${cyfs.CoreObjectType.AppStoreList}`,
            cyfs.RouterHandlerAction.Pass,
            cyfs.Some(eventProcessor)
        );
    }

    async getObjectId(url: string) {
        var myHeaders = new Headers();
        var myRequest = new Request(url, { method: 'GET', headers: myHeaders, mode: 'cors', cache: 'default' });
        fetch(myRequest).then((response) => {
            if (response.status == 200) {
                return response.blob();
            } else {
                alert('解析错误');
                return;
            }
        }).then(async (myBlob) => {
            return myBlob?.arrayBuffer();
        }).then(async (buffer) => {
            console.log('new Uint8Array(buffer)', url, new Uint8Array(buffer!), new Uint8Array(buffer!).toHex())
            const [dec_app, rest] = new cyfs.DecAppDecoder().raw_decode(new Uint8Array(buffer!));
            console.log('dec_app', dec_app)
            let putApp = await objectManager.putObj(dec_app);
            if (putApp.err && putApp.val.code != cyfs.BuckyErrorCode.Ignored) {
                alert('添加失败');
                return;
            }
            objectManager.addToStore(dec_app.desc().calculate_id());
        });
    };

    async addToStore(id: cyfs.ObjectId) {
        let result = await this.m_util_service.get_device({ common: { flags: 0 } });
        if (!result.err) {
            result = result.unwrap()
        }
        let current_device = result.device
        console.log('current_device: ', current_device)
        let owner = current_device.desc().owner().unwrap();
        let app_store_list_id = cyfs.AppStoreList.create(owner).desc().calculate_id();

        let ret = await ObjectUtil.getObject({ id: app_store_list_id, decoder: cyfs.AppStoreListDecoder.create() });
        console.log('------------------rsssssssssset', ret)
        let list;
        if (ret.err) {
            let owner = current_device.desc().owner().unwrap();
            list = cyfs.AppStoreList.create(owner);
        } else {
            [list,] = ret;
        }
        list.put(id);
        let putResult = await objectManager.putObj(list);
        if (putResult.err && putResult.val.code != cyfs.BuckyErrorCode.Ignored) {
            alert('添加失败');
        } else {
            objectManager.getAllAppList();
        }
    }

    async installAllFun(id: string, ver: string, status: boolean, isStop?: boolean) {
        let idObj: cyfs.DecAppId | null = null;
        APPLIST.forEach(app => {
            if (id == app.app_id.toString()) {
                idObj = app.app_id;
            }
        });
        if (!idObj) {
            return;
        }
        console.log('id, ver, status, isStop:', id, ver, status, isStop)
        let result = await this.m_util_service.get_device({ common: { flags: 0 } });
        if (!result.err) {
            result = result.unwrap()
        }
        let current_device = result.device
        console.log('current_device: ', current_device)
        let owner = current_device.desc().owner().unwrap();

        // 创建一个App Status对象，这个对象表示OOD上这个App的应有状态
        let app_status = cyfs.AppStatus.create(owner, idObj, ver, status);
        console.log('app_status:', app_status)
        let r = await objectManager.putObj(cyfs.PutApp.create(owner, [app_status]));
        console.log('安装:', r);
        if (r.err && r.val.code != cyfs.BuckyErrorCode.Ignored) {
            if (status) {
                // alert('运行失败！');
            } else {
                if (isStop) {
                    // alert("停止失败！");
                } else {
                }
            }
            return r;
        } else {
            if (status) {
                // alert('运行成功！');
            } else {
                if (isStop) {
                    // alert("停止成功！");
                } else {
                }
            }
        }
    }

    async removeApp(id: string) {
        let idObj: cyfs.DecAppId | null = null;
        APPLIST.forEach(app => {
            if (id == app.app_id.toString()) {
                idObj = app.app_id;
            }
        });
        if (!idObj) {
            return;
        }
        DELETEID = idObj;
        let get_device_result = await this.m_util_service.get_device({ common: { flags: 0 } });
        if (!get_device_result.err) {
            get_device_result = get_device_result.unwrap()
        }
        let current_device = get_device_result.device
        console.log('current_device: ', current_device)
        let owner = current_device.desc().owner().unwrap();
        let result = await objectManager.putObj(cyfs.RemoveApp.create(owner, [idObj]));
        console.log('卸载结果:', result)
        if (result.err && result.val.code != cyfs.BuckyErrorCode.Ignored) {
            $('.install_box').css('display', 'none');
            alert('卸载失败');
        } else {
            // alert('卸载成功');
        }
    }

    async analysisStautsEvent(buf: Buffer) {
        const [app,] = new cyfs.AppLocalStatusDecoder().raw_decode(buf).unwrap();
        console.log('app', app)
        const appid = app.app_id().object_id.to_base_58();
        console.log('AppLocalStatusDecoder', app, appid, app.status())
        console.log('CURRENTAPPID, DELETEID', CURRENTAPPID, DELETEID)
        if (appid == CURRENTAPPID) {
            $('.install_box').css('display', 'none');
            ISSTATUS = false;
            CURRENTAPPID = '';
        }
        if (app.status() != 2 && !DELETEID) {
            $('.install_box').css('display', 'none');
        }
        objectManager.getAppList()
    }

    async analysisObjectEvent(buf: Buffer) {
        console.log('---DELETEID, ISSTATUS', DELETEID, ISSTATUS)
        if (DELETEID) {
            const result = new cyfs.AppListDecoder().raw_decode(buf).unwrap();
            console.log('analysisObjectEvent-result:', result)
            if (result.err) {
            } else {
                let [appList,] = result;
                let isDelete = true;
                console.log('-------appList', appList, appList.app_list(), DELETEID);
                for (const [appid,] of appList.app_list()) {
                    if (appid.object_id == DELETEID) {
                        isDelete = false;
                    }
                }
                if (isDelete) {
                    DELETEID = '';
                    $('.install_box').css('display', 'none');
                }
            }
        }
        if (!ISSTATUS) {
            objectManager.getAppList();
        }
    }
}

class ObjectEventProcessor {
    async call(param: cyfs.BuckyResult<cyfs.DecApp>) {
        let buf = param.request.object.object_raw;
        console.log('buf', buf)
        objectManager.analysisObjectEvent(buf);
        const result = {
            action: cyfs.RouterHandlerAction.Pass,
        };

        return cyfs.Ok(result);
    }
}

class ObjectStautsEventProcessor {
    async call(param: cyfs.BuckyResult<cyfs.AppStatus>) {
        let buf = param.request.object.object_raw;
        console.log('buf', buf)
        objectManager.analysisStautsEvent(buf);
        const result = {
            action: cyfs.RouterHandlerAction.Pass,
        };

        return cyfs.Ok(result);
    }
}

class ObjectStoreEventProcessor {
    async call() {
        objectManager.getAllAppList()
        const result = {
            action: cyfs.RouterHandlerAction.Pass,
        };

        return cyfs.Ok(result);
    }
}
const objectManager = new ObjectManager();

var url = 'http://127.0.0.1:1321/check';
var ajax = new XMLHttpRequest();
ajax.open('get', url, true);
ajax.send();
ajax.onreadystatechange = function () {
    if (ajax.readyState == 4 && ajax.status == 200) {
        const result = JSON.parse(ajax.responseText)
        if (result.activation) {
            objectManager.getOodStatus();
            objectManager.getAppList();
            objectManager.getAllAppList();
            objectManager.appListListener();
            objectManager.appStatusListener();
            objectManager.appStoreListListener();
        } else {
            $('.install_content_box').css('display', 'none');
            $('#store_list').css('display', 'none');
            $('.unconnect_ood').css('display', 'block');
        }
    }
}

async function addApp() {
    let coverInput = $('#cover_input').val()?.toString() || "";
    let txt = coverInput.replace('cyfs:/', 'http://127.0.0.1:8090');
    objectManager.getObjectId(txt);
    closeCover();
    $('#cover_input').val('');
}

$("#store_list").on("click", ".install_btn", function () {
    let id = $(this).attr("data-appid");
    let index = Number($(this).attr("data-key"));
    let appVersionVal = $('appVersionBox')?.eq(index)?.val()?.toString() || '';
    console.log('id, index, appVersionVal', id, index, appVersionVal);
    if (id) {
        let isInstall = true;
        installAppList.forEach(element => {
            if (element.app_id.to_base_58() == id && element.app_version == appVersionVal) {
                isInstall = false
            }
        });
        if (isInstall) {
            $('.installing_text').html('安装中......');
            $('.install_box').css('display', 'block');
            objectManager.installAllFun(id, appVersionVal, true);
        }
    }
})

$("#install_list").on("click", ".install_remove_btn", function () {
    let id = $(this).attr("data-appid");
    if (id) {
        removeAppFun(id);
    }
})

let removerId = "";
function removeAppFun(id: string) {
    removerId = id;
    openRemoveCover();
}

$("#install_list").on("click", ".run_app_btn", function () {
    let id = $(this).attr("data-appid") || '';
    let version = $(this).attr("data-version") || '';
    let isRun = JSON.parse(($(this).attr("data-isrun") || "").toLowerCase());
    runAppFun(id, version, isRun);
})

function runAppFun(id: string, appVersionVal: string, isRun: boolean) {
    console.log('id, appVersionVal, isRun', id, appVersionVal, isRun)
    CURRENTAPPID = id;
    ISSTATUS = true;
    if (!isRun) {
        $('.installing_text').html('停止中......');
        $('.install_box').css('display', 'block');
        objectManager.installAllFun(id, appVersionVal, isRun, true);
    } else {
        $('.installing_text').html('运行中......');
        $('.install_box').css('display', 'block');
        objectManager.installAllFun(id, appVersionVal, isRun);
    }
}

$("#install_list").on("click", ".refresh_btn", function () {
    let id = $(this).attr("data-appid") || '';
    let index = Number($(this).attr("data-key")) || 0;
    refreshVersionFun(id, index);
})

async function refreshVersionFun(id: string, index: number) {
    let installVerHtml = (document.querySelectorAll("#install_ver"))[index].innerHTML;
    console.log('installVerHtml', installVerHtml, index)
    let list = await objectManager.getAppListFunc();
    if (list.app_list().size) {
        for (const [appid, status] of list.app_list()) {
            if (appid.object_id == id) {
                installVerHtml = status.version();
            }
        }
    }
    alert('刷新成功!');
}

function searchName() {
    let name = $('#search_box_txt').val()?.toString().trim();
    objectManager.getAllAppList(name);
    objectManager.getAppList(name);
}

// auto add event

$('.application_search_icon').on('click', (event) => {
    searchName()
})

$('.add_url_btn').on('click', (event) => {
    openCover()
})

$('.close_svg').on('click', (event) => {
    closeCover()
})

$('.cover_btn').on('click', (event) => {
    addApp()
})

$('.close_svg').on('click', (event) => {
    closeRemoveCover()
})

$('.comfirm_remove_btn').on('click', (event) => {
    removeAppConfirm()
})

$('.cancel_remove_btn').on('click', (event) => {
    closeRemoveCover()
})

$('#search_box_txt').on('keydown', (event) => {
    if (event.keyCode == 13) { searchName() }
})
