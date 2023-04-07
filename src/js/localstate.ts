import { val } from 'cheerio/lib/api/attributes';
import * as cyfs from '../cyfs_sdk/cyfs'
let QRCode = require('qrcode')
import { ObjectUtil, formatDate, getSubStr, castToLocalUnit, STATUSTYPE, LANGUAGESTYPE, TXTYPES } from './lib/util'

import {
    initObjectMapByPath,
    initObjectSetByPath,
    objectMapForEach,
} from "./object_map";

import {
    makeRLink
} from "./url"


$(function(){
    if(LANGUAGESTYPE == 'zh'){
        $('title').html('本地状态浏览');
    }else{
        $('title').html('Local Root State');
    }
});
let object_id: cyfs.ObjectId;
let zone_id: cyfs.ObjectId;
let owner_id: cyfs.ObjectId;
let PAGE_INDEX = 0;
let MAP_LENGTH:number = 0;
let CHANNEL = 'beta';
let IS_RETURN: boolean = false;

class Util {
    m_sharedStack: cyfs.SharedCyfsStack;
    m_util_service: cyfs.UtilRequestor;
    m_router: cyfs.NONRequestor;
    constructor() {
        // ROOT_STATE 必须要添加dec id
        const owner = cyfs.ObjectId.from_base_58(
            "5r4MYfFDmENKMkjtaZztmnpSNTDSoRd6kCWuLSo4ftMS"
        ).unwrap();
        const system_dec_id = cyfs.DecApp.generate_id(owner, "cyfs-system-service");
        console.log(`dec_id: ${system_dec_id}`)
        this.m_sharedStack = cyfs.SharedCyfsStack.open_runtime();
        this.m_util_service = this.m_sharedStack.util();
        this.m_router = this.m_sharedStack.non_service();
    }

    async runtime_with_decid(dec_id_str: string) {
        // ROOT_STATE 必须要添加dec id
        const dec_id = cyfs.ObjectId.from_base_58(dec_id_str).unwrap();
        this.m_sharedStack = cyfs.SharedCyfsStack.open_runtime(dec_id);
        this.m_util_service = this.m_sharedStack.util();
        this.m_router = this.m_sharedStack.non_service();
    }

    async getZoneInfo(is_local: boolean) {
        // Device静态信息 local-state
        let current_device_static_info = await this.m_util_service.get_device_static_info({ common: { flags: 0 } });
        if (!current_device_static_info.err) {
            current_device_static_info = current_device_static_info.unwrap().info;
        }
        console.info('current_device_static_info:', current_device_static_info);
        let local_device_id = current_device_static_info.device_id.object_id;

        // 查询自己所属的zone
        const r = await this.m_util_service.get_zone({
            common: {flags: 0},
        });
        if (r.err) {
            console.error("get_zone err", r.val);
            return
        }

        const resp = r.unwrap();
        // 获取zone 内的ood 设备和 device 设备两种
        console.info(`get zone ${resp.zone_id}, ${resp.zone.ood_list()}, ${resp.zone.known_device_list()} success`);
        document.getElementById('zoneid')!.innerHTML = resp.zone_id.object_id.toString();

        const stack = util.m_sharedStack;    
        const root_state_stub = stack.root_state_stub();
    
        // get_current_root
        {
            const r = await root_state_stub.get_current_root();
            if (r.err) {
                console.log(`get_current_root failed, err = ${r}`);
            } else {
                console.log(
                    `get_current_root success, current root =  ${r.unwrap().root
            }, revision = ${r.unwrap().revision}`
                );
            
                document.getElementById('root')!.innerHTML = r.unwrap().root;
                document.getElementById('revision')!.innerHTML = r.unwrap().revision;
            }
        }

        // get_dec_root
        {
            const r = await root_state_stub.get_dec_root();
            if (r.err) {
            console.log(`get_dec_root failed, err = ${r}`);
            document.getElementById('dec_root')!.innerHTML = '--';
            document.getElementById('dec_revision')!.innerHTML = '--';
            } else {
            console.log(
                `get_dec_root success , return [root =  ${
                r.unwrap().root
                }, dec_root = ${r.unwrap().dec_root}] `
            );
            document.getElementById('dec_root')!.innerHTML = r.unwrap().dec_root.toString();
            document.getElementById('dec_revision')!.innerHTML = r.unwrap().revision.toString();
            }
        }

        
        let ood_list = resp.zone.ood_list();
        let device_list = resp.zone.known_device_list();
        let open_table_tbody = document.getElementById('open_device_table_tbody')!;

        let objHtml = ``;

        if (!is_local && ood_list && ood_list.length ) {
            ood_list.forEach(element => {
                objHtml += `<tr>   
                <td><a class="color_475" target="_blank" href="cyfs://static/localstate.html?owner=${element.object_id.toString()}">${element.object_id.toString()}</a></td>
                <td>ood</td>
                </tr>`;
            });
        }

        if (!is_local && device_list && device_list.length ) {
            device_list.forEach(element => {
                objHtml += `<tr>   
                <td><a class="color_475" target="_blank" href="cyfs://static/localstate.html?owner=${element.object_id.toString()}">${element.object_id.toString()}</a></td>
                <td>device</td>
                </tr>`;
            });
        }
        
        // 置灰
        if (owner_id != undefined) {
            objHtml = `<tr>   
            <td>${owner_id.toString()}</td>
            <td>device</td>
            </tr>`;
        }

        if (is_local) {
            objHtml += `<tr>   
            <td><a class="color_475" target="_blank" href="cyfs://static/localstate.html?owner=${local_device_id.toString()}">${local_device_id.toString()}</a></td>
            <td>device</td>
            </tr>`;
        }

        open_table_tbody.innerHTML = objHtml;

/*
        let path = "/c";

        // initialize localstate root state
        const ir = await initObjectMapByPath(
            path,
            this.m_sharedStack
        );
        if (ir.err) {
            console.error(
                `load sync files failed when load single_op, ${ir}.`
            );
            return ir;
        }

        const testMap = ir.unwrap();
        // 添加测试数据
        let id = "test-system";
        const nameObj = cyfs.TextObject.create(cyfs.None, id, "TestName", "");
        const ar = await testMap.set(id, nameObj.desc().object_id(), true);
        if (ar.err) {
            console.error(
                `load sync files failed when add to single_op for add text (${id}), ${ar}.`
            );
            return ar;
        }
        
        // 提交
        testMap.commit();

        const enumPath = async (
            path: string,
            options: {
                stack: cyfs.SharedCyfsStack;
            },
            result: { [arr: string]: string }
        ): Promise<cyfs.BuckyResult<{ [arr: string]: string }>> => {
            const ar = await objectMapForEach(
                path,
                (objectId, value) => {
                    result[value] = makeRLink(objectId, value);
                    console.log(`result: ${result[value]}`);
                    return false;
                },
                options
            );
            if (ar.err) {
                console.error(`enum path failed, ${ar}`);
                return ar;
            }
            return cyfs.Ok(result);
        };

        const loadResultMap: {
            [arr: string]: string;
        } = {};

        loadResultMap[path] = "";

        let ret = await enumPath(path, {
            stack: this.m_sharedStack,
        }, loadResultMap);


        if (ret.ok) {
           console.log(`opEnv get: ${ret}`)
        }
        */
    }

    async dec_list(
        inner_path: string,
        to: cyfs.ObjectId,
        operation?: string) {
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

        let treeLists = await listRootTree(inner_path, to, PAGE_INDEX, 10);

        let open_table_tbody = document.getElementById('open_dec_table_tbody')!;
        let subs = inner_path.split("/");
        let simple_path =inner_path;
        if (subs.length > 2) {
            simple_path = [subs[0], subs[1], "...", subs[subs.length - 1]].join("/");
        }
        let objHtml = ``;
        if (treeLists.items && treeLists.items.length ) {
            console.origin.log('---------------treeLists', PAGE_INDEX, treeLists);
            treeLists.items.forEach(element => {
                if (element != undefined) {
                    let internal = [inner_path, element.name].join("/");
                    let dec_id = `<a class="color_475 target="_blank" href="cyfs://static/localstate.html?dec_id=${element.dec_id}&inner_path=${internal}&owner_id=${to}">${element.name}</a>`;
                    if (element.type != "ObjectMap") {
                        dec_id = `${element.name}`;
                    }
                    console.log(`internal_path: ${internal}`);
                    objHtml += `<tr>   
                                    <td>${dec_id}</td>
                                </tr>`;
                }

            });
            if (PAGE_INDEX > 0 && $('#page_div span').eq(PAGE_INDEX).siblings().length < PAGE_INDEX) {
                $('#page_div').append(`<span>${PAGE_INDEX+1}</span>`);
            }
            MAP_LENGTH = treeLists.items.length;
            $('#page_div span').eq(PAGE_INDEX).addClass('choose_index').siblings().removeClass("choose_index");
            open_table_tbody.innerHTML = objHtml;

            // console.log(`PAGE_INDEX: ${PAGE_INDEX}, MAP_LENGTH: ${MAP_LENGTH}`);

        }
        IS_RETURN = false;
        
    }

    async tree_list(
        dec_id: string,
        inner_path: string,
        to: cyfs.ObjectId,
        operation?: string) {

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

        let treeLists = await listRootTree(inner_path, to, PAGE_INDEX, 10);

        let open_dec_table_tbody = document.getElementById('open_dec_table_tbody')!;

        open_dec_table_tbody.innerHTML = `<tr><td>${dec_id}</td></tr>`;;

        let open_table_tbody = document.getElementById('open_tree_table_tbody')!;

        let objHtml = `<tr><td><a class="color_475" target="_blank">${inner_path}</a></td></tr><br>`;
        if (treeLists.items && treeLists.items.length ) {
            console.origin.log('---------------treeLists', PAGE_INDEX, treeLists);
            treeLists.items.forEach(element => {
                if (element != undefined) {
                    let internal = [inner_path, element.name].join("/");
                    let app_dec_id = `<a class="color_475 target="_blank" href="cyfs://static/localstate.html?dec_id=${dec_id}&inner_path=${internal}&owner_id=${to}">${element.name}</a>`;
                    if (element.type != "ObjectMap") {
                        // mode=object
                        app_dec_id = `${element.name}`;
                    }
                    console.log(`internal_path: ${internal}`);
                    objHtml += `<tr>   
                                    <td>${app_dec_id}</td>
                                    <td>${element.type}</td>
                                    <td><a class="color_475" target="_blank" href="./object_browser/objects.html?id=${element.object_id}" target="_blank">${getSubStr(element.object_id)}</a></td>
                                </tr>`;
                }

            });
            if (PAGE_INDEX > 0 && $('#page_div span').eq(PAGE_INDEX).siblings().length < PAGE_INDEX) {
                $('#page_div').append(`<span>${PAGE_INDEX+1}</span>`);
            }
            MAP_LENGTH = treeLists.items.length;
            $('#page_div span').eq(PAGE_INDEX).addClass('choose_index').siblings().removeClass("choose_index");
            open_table_tbody.innerHTML = objHtml;

            // console.log(`PAGE_INDEX: ${PAGE_INDEX}, MAP_LENGTH: ${MAP_LENGTH}`);

        }
        IS_RETURN = false;
        
    }
}


interface ObjectContentItem {
    name: string,
    object_id: cyfs.ObjectId,
    type: string,
    owner_info: string,
    dec_id: string,
}

export interface CategoryTree {
    name: string;
    items: ObjectContentItem[];
    // subCategories: CategoryTree[];
}

/**
 * 特定路径下的完整目录树
 * @param path /a/b
 * @param to
 */
async function listRootTree(
    path: string,
    to: cyfs.ObjectId,
    page_index: number,
    page_size: number,
): Promise<CategoryTree> {
    console.info(`listRootTree ${path}`);
    const { items, subCategories } = await listObjectMapSetInPath(path, to, page_index, page_size);

    // const nextSubs = await Promise.all(
    //     subCategories.map(async (subName: string) => {
    //         const subPath = [
    //             "",
    //             ...path.split("/").filter((p) => p.length > 0),
    //             subName,
    //         ].join("/");
    //         return await listRootTree(subPath, to);
    //     })
    // );

    const paths = path.split("/");
    return {
        name: paths.length > 0 ? paths[paths.length - 1] : "",
        items,
        //subCategories: nextSubs,
    };
}

export async function listObjectMapSetInPath(
    path: string,
    to: cyfs.ObjectId,
    page_index: number,
    page_size: number
): Promise<{ items: ObjectContentItem[]; subCategories: string[] }> {
    let items: ObjectContentItem[] = [];
    items = await listObjectSetInPath(path, to, page_index, page_size);
    const subCategories = await listSubObjecectMapInPath(path, to);
    return { items, subCategories };
}


// 从特定路径列举ObjectMap列表
export async function listObjectSetInPath(path: string, to: cyfs.ObjectId, page_index: number, page_size: number) {
    return await listMapSetInPath(path, to, page_index, page_size);
}

async function listMapSetInPath(
    path: string,
    to: cyfs.ObjectId,
    page_index: number,
    page_size: number,
): Promise<ObjectContentItem[]> {

    const stack = util.m_sharedStack;
    const access = stack.root_state_access_stub(to);

    const lr = await access.list(path, page_index, page_size);
    console.log(`inner_path: ${path}, page_index: ${page_index}, page_size: ${page_size}`);

    if (lr.err) {
        console.error(`list-texts in(${path}) io failed, ${lr}`);
        return [];
    }

    const contentsRetRow = lr.unwrap();
    console.log(`length: ${contentsRetRow.length}`)
    
    const contentsRet = await Promise.all(
        contentsRetRow.map(async (item: cyfs.ObjectMapContentItem) => {
            if (item.content_type === cyfs.ObjectMapSimpleContentType.Set) {
                const ret_result = await ObjectUtil.getObject({ id: item.set!.value!, isReturnResult: true })
                console.log(`ret_result objectset: ${ret_result}`);
                if (ret_result.err) {

                } else{
                    let ret_info: cyfs.NONObjectInfo = ret_result.object;
                    console.log('----------------objectid', ret_info.object)
                    if(ret_info.object?.desc().calculate_id()){

                        let objectId = ret_info.object?.desc().calculate_id().to_base_58() || '';
                        let type = ret_info.object?.desc().obj_type_code()?cyfs.ObjectTypeCode[ret_info.object?.desc().obj_type_code()!] : '-';
                        //所有者
                        let owner_info: string = "-";
                        if (ret_info.object?.desc().owner()) {
                            owner_info = ret_info.object!.desc().owner()!.unwrap().toString();
                        }

                        // nonce
                        let nonce = '--';
                        // if (ret_info.object.nonce().is_some()) {
                        //     let nonce = ret_info.object.nonce().unwrap();
                        //     console.origin.log('----------------nonce', nonce)
                        // }
                        let decid:string = '';
                        if(ret_info.object?.desc().dec_id().is_some()){
                            decid = ret_info.object?.desc().dec_id().unwrap().toString();
                        }

                        if (ret_info.object?.desc().obj_type() == cyfs.CoreObjectType.Msg) {
                            let msg_ret = (new cyfs.MsgDecoder()).raw_decode(new Uint8Array(ret_info.object_raw));
                            console.log('------------msg_ret', msg_ret)
                            if (msg_ret.err) {
                            } else {
                                let [msg,] = msg_ret.unwrap();
                                console.log('------------msg', msg)
                                msg.desc().content().content.match({
                                    Text: (text: string) => {
                                        console.log(`msg_text: ${text}`);
                                    }
                                });
                            }
                        }

                        console.log(`object_id: ${objectId}, type: ${type}, owner_info: ${owner_info}, dec_id: ${decid}`);
                        
                        let ret: ObjectContentItem = {
                            name: item.set!.value.toString(),
                            object_id: ret_info.object?.desc().calculate_id(),
                            type: type,
                            owner_info: owner_info,
                            dec_id: decid,
                        }

                        return ret;
                        
                    }

                }
            } else if (item.content_type === cyfs.ObjectMapSimpleContentType.Map) {
                const ret_result = await ObjectUtil.getObject({ id: item.map!.value!, isReturnResult: true })
                console.log(`ret_result objectmap: ${ret_result}`);
                if (ret_result.err) {
                }else
                {
                    let ret_info: cyfs.NONObjectInfo = ret_result.object;
                    console.log('----------------objectid', ret_info.object)
                    if(ret_info.object?.desc().calculate_id()){

                        let objectId = ret_info.object?.desc().calculate_id().to_base_58() || '';
                        let type = ret_info.object?.desc().obj_type_code()?cyfs.ObjectTypeCode[ret_info.object?.desc().obj_type_code()!] : '-';
                        //所有者
                        let owner_info: string = "-";
                        if (ret_info.object?.desc().owner()) {
                            owner_info = ret_info.object!.desc().owner()!.unwrap().toString();
                        }

                        // nonce
                        let nonce = '--';
                        // if (ret_info.object.nonce().is_some()) {
                        //     let nonce = ret_info.object.nonce().unwrap();
                        //     console.origin.log('----------------nonce', nonce)
                        // }
                        let decid:string = '';
                        if(ret_info.object?.desc().dec_id().is_some()){
                            decid = ret_info.object?.desc().dec_id().unwrap().toString();
                        }

                        if (ret_info.object?.desc().obj_type() == cyfs.CoreObjectType.Msg) {
                            let msg_ret = (new cyfs.MsgDecoder()).raw_decode(new Uint8Array(ret_info.object_raw));
                            console.log('------------msg_ret', msg_ret)
                            if (msg_ret.err) {
                            } else {
                                let [msg,] = msg_ret.unwrap();
                                console.log('------------msg', msg)
                                msg.desc().content().content.match({
                                    Text: (text: string) => {
                                        console.log(`msg_text: ${text}`);
                                    }
                                });
                            }
                        }

                        console.log(`object_id: ${objectId}, type: ${type}, owner_info: ${owner_info}, dec_id: ${decid}`);
                        
                        let ret: ObjectContentItem = {
                            name: item.map!.key,
                            object_id: ret_info.object?.desc().calculate_id(),
                            type: type,
                            owner_info: owner_info,
                            dec_id: decid,
                        }

                        return ret;
                        
                    }

                }
            }
        })
    );

    console.info(`list objectmapset at(${path}): ${JSON.stringify(contentsRet)}`);

    return contentsRet;
}

// 从特定路径列举所有子分类列表
export async function listSubObjecectMapInPath(path: string, to: cyfs.ObjectId) {
    const stack = util.m_sharedStack;
    const access = stack.root_state_access_stub(to);
    const lr = await access.list(path, 0, 10);

    if (lr.err) {
        console.error(
            `list-subdirs in(${path}) io failed, ${lr}`
        );
        return [];
    }

    const contentsRow = lr.unwrap();
    const contentsRet = contentsRow.map((item: cyfs.ObjectMapContentItem) => item.map!.key);
    return contentsRet;
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
}
const meta_client = new MetaClient();

function jump_dec_list(inner_path: string, to: cyfs.ObjectId, operation?: string) {
    console.log(`inner_path: ${inner_path}, to: ${to}, operation: ${operation}`);
    util.dec_list(inner_path, to, operation);
}

function jump_tree_list(dec_id: string, inner_path: string, to: cyfs.ObjectId, operation?: string) {
    console.log(`inner_path: ${inner_path}, to: ${to}, operation: ${operation}`);
    util.tree_list(dec_id, inner_path, to, operation);
}

function initData(operation?: string) {
    if (window.location.search.split("?")[1]) {
        let params = window.location.search.split("?")[1];
        if (params) {
            let key = params.split('=')[0];
            let value = params.split('=')[1];
            console.log(`params: key: ${key}, value: ${value}`);
            if (key === "owner") {
                owner_id = cyfs.ObjectId.from_base_58(value).unwrap();
                util.getZoneInfo(false);
                jump_dec_list("/", owner_id, operation);
            } else if (key === "local_cache") {
                return;
            }else {
                let p1 = params.split('&')[0];
                let key1 = p1.split('=')[0];
                let value1 = p1.split('=')[1];

                let p2 = params.split('&')[1];
                let key2 = p2.split('=')[0];
                let value2 = p2.split('=')[1];

                let p3 = params.split('&')[2];
                let key3 = p3.split('=')[0];
                let value3 = p3.split('=')[1];

                // 内部路径不能加上decid, 裁剪掉
                if (value2.search("//9tGpLN") != -1 )  {
                   value2 = "/";
                }
                owner_id = cyfs.ObjectId.from_base_58(value3).unwrap();
                console.log(`dec_id: ${value1}, owner_id: ${owner_id}, localstate: ${value2}`)
                util.runtime_with_decid(value1); 
                util.getZoneInfo(false);
                jump_tree_list(value1, value2, owner_id, operation);
            }
        }
    }
}

$('.anonymous_subtitle').on('click', async function () {
    localStorage.removeItem('is-init-show-guide');
    window.open('https://browser.cyfs.com/init.html');
})

$.ajax({
    url: 'http://127.0.0.1:38090/status',
    success:function(result){
        console.log('getStatus-result', result);
        CHANNEL = result.channel;
        if(result.anonymous){
            $('.anonymous_box').css('display', 'block');
        }
        
        if (window.location.search.split("?")[1]) {
            let params = window.location.search.split("?")[1];
            if (params) {
                let key = params.split('=')[0];
                let value = params.split('=')[1];
                if (key === "local_cache" && value ==='true') {
                    util.getZoneInfo(true);
                    initData();
                    return;
                }
            }
        }
        util.getZoneInfo(false);
        initData();
    }
});


$('#reward_record_cover_box').on('click', (event) => {
    document.getElementById('reward_record_cover_box')!.style.display = 'none'
})

$('.last_page, .next_page_btn').on('click', () => {
    if(MAP_LENGTH == 10){
        initData('add');
    }
})

$('.first_page, .last_page_btn').on('click', () => {
    if(PAGE_INDEX > 0){
        initData('reduce');
    }
})
