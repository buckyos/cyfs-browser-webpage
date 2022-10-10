import * as cyfs from '../cyfs_sdk/cyfs.d'
import $ from 'jquery'
let QRCode = require('qrcode')
import { ObjectUtil, formatDate, getSubStr, hasPC, LANGUAGESTYPE, castToLocalUnit, STATUSTYPE, TXTYPES } from './lib/util'
import { toast } from './lib/toast.min'

$(function(){
    if(LANGUAGESTYPE == 'zh'){
        $('title').html('对象浏览');
    }else{
        $('title').html('CYFS Object Browser');
    }
});

var ISPC = hasPC();
let CHANNEL = 'beta';
let IS_RETURN: boolean = false;
let TX_LENGTH:number = 0;
let PAGE_INDEX = 0;
let TRANS_PAGE_INDEX = 0;
let REQ_PARAMS: cyfs.NONSelectObjectOutputRequest;
let RET_OBJECTS: { object: cyfs.AnyNamedObject | undefined, object_raw: Uint8Array | undefined }[] = [];
let ALL_OBJECT: { id: string, type: cyfs.ObjectTypeCode |undefined, owner_info:string, time: cyfs.JSBI, decid: string, nftIcon: string }[] = [];
let objectId = "";
class ObjectManager {
    m_sharedStatck: cyfs.SharedCyfsStack;
    m_router: cyfs.NONRequestor;
    meta_client: cyfs.MetaClient;
    constructor() {
        this.m_sharedStatck = cyfs.SharedCyfsStack.open_runtime(cyfs.get_system_dec_app().object_id);
        this.m_router = this.m_sharedStatck.non_service();
        this.meta_client = cyfs.create_meta_client();
    }

    async fetchObjects(search_value?: string, isOtherPage?: boolean) {
        RET_OBJECTS = []
        const router = this.m_router;
        let ownerId: cyfs.ObjectId | undefined;
        if (search_value) {
            let idResult = cyfs.ObjectId.from_base_58(search_value);
            if (idResult.err) {
                toast({
                    message: LANGUAGESTYPE == 'zh'?"Id格式不对":'wrong ID format',
                    time: 1500,
                    type: 'warn'
                });
            } else {
                ownerId = idResult.unwrap()
            }
        }
        // insertTime = new cyfs.SelectTimeRange(JSBI.BigInt(0), cyfs.bucky_time_now());
        const option = {
            page_index: PAGE_INDEX,
            page_size: 10
        };
        let req: cyfs.NONSelectObjectOutputRequest = {
            filter: {
                insert_time: undefined,
                owner_id: ownerId
            },
            opt: option,
            common: {
                level: cyfs.NONAPILevel.Router,
                flags: 0
            }
        }
        if (isOtherPage) {
            req = REQ_PARAMS;
        }
        REQ_PARAMS = req;
        console.origin.log('----------------------req', req)
        const r: cyfs.BuckyResult<cyfs.NONSelectObjectOutputResponse> = await router.select_object(req);
        console.origin.log('----------------------r ', r)
        var browser_tbody = document.getElementById('browser_tbody')!;
        if (r.err) {
            console.log("request select object error, result:", r);
            browser_tbody.innerHTML = "";
            return;
        }
        let ret = r.unwrap();
        if (!search_value && ret.objects && ret.objects.length > 10) {
            ret.objects = ret.objects.splice(0, 10);
        }
        // let objects:cyfs.SelectResponseObjectInfo[] = [];
        let objects: { object: cyfs.AnyNamedObject | undefined, object_raw: Uint8Array | undefined }[] = [];
        for (const key in ret) {
            const items = ret[key];
            for (const inner_key in items) {
                const item = items[inner_key];
                let object_tmp = { object: undefined, object_raw: undefined };
                if (item.object != null) {
                    object_tmp.object = item.object;
                }
                if (item.object_raw != null) {
                    object_tmp.object_raw = item.object_raw;
                }
                if (object_tmp.object) {
                    objects.push(object_tmp)
                }
            }
        }
        console.origin.log("--------------objects:", objects);
        RET_OBJECTS = objects;
        if (!objects || objects.length == 0) {
            $('#browser_tbody').html("");
        }
        ALL_OBJECT = [];
        let temporaryObj = [];
        for (let index = 0; index < objects.length; index++) {
            const element = objects[index];
            //所有者
            let owner_info = "";
            if (element.object?.desc().owner()) {
                owner_info = element.object.desc().owner()!.unwrap().toString();
            }
            
            let decid:string = '';
            if(element.object?.desc().dec_id().is_some()){
                decid = element.object?.desc().dec_id().unwrap().toString();
            }
            let getNftR = await this.meta_client.nft_get(element.object!.desc().calculate_id().toString());
            let nftIcon = '';
            console.log('getNftR', getNftR)
            if(!getNftR.err && getNftR.result.owner_id){
                nftIcon = '<i class="is_nft_icon"></i>';
            }
            console.log('----calculate_id',element.object!.desc().calculate_id().toString())

            temporaryObj.push({ 
                id: element.object!.desc().calculate_id().toString(),
                type: element.object?.desc().obj_type_code(),
                owner_info: owner_info,
                time: element.object!.desc().create_time(),
                decid: decid,
                nftIcon: nftIcon
            });
        }
        ALL_OBJECT = temporaryObj;
        console.origin.log('ALL_OBJECT', ALL_OBJECT)
        handleObject();
    }
}

const objectManager = new ObjectManager();

async function handleObjectRender(objects:{ id: string, type: cyfs.ObjectTypeCode |undefined, owner_info:string, time: cyfs.JSBI, decid: string, nftIcon: string }[]) {
    var browser_tbody = $('#browser_tbody');
    let tbody_Html = "";
    objects.forEach((element:{ id: string, type: cyfs.ObjectTypeCode |undefined, owner_info:string, time: cyfs.JSBI, decid: string, nftIcon: string }) => {
        tbody_Html += `<tr>
                            <th><a class="object_click_a float_l" href="./objects.html?id=${element.id}">${getSubStr(element.id)}</a>${element.nftIcon}</th>
                            <th>${element.type?cyfs.ObjectTypeCode[element.type!] : '-'}</th>
                            <th>${formatDate(cyfs.bucky_time_2_js_time(element.time))}</th>
                            <th><a class="object_click_a" href="./objects.html?id=${element.owner_info}">${element.owner_info?getSubStr(element.owner_info):'-'}<a></th>
                            <th><a class="object_click_a" href="./objects.html?id=${element.decid}">${element.decid?getSubStr(element.decid):'-'}<a></th>
                        </tr>`;

    });
    browser_tbody.html(tbody_Html);
    document.getElementById("lastest_box")!.style.display = "block";
    document.getElementById("detail_box")!.style.display = "none";
}

class FileInfo {
    m_sharedStatck: cyfs.SharedCyfsStack;
    m_util_service: cyfs.UtilRequestor;
    m_router: cyfs.NONRequestor;
    meta_client: cyfs.MetaClient;

    constructor() {
        this.m_sharedStatck = cyfs.SharedCyfsStack.open_runtime(cyfs.get_system_dec_app().object_id);
        this.m_util_service = this.m_sharedStatck.util();
        this.m_router = this.m_sharedStatck.non_service();
        this.meta_client = cyfs.create_meta_client();

    }

    async getOodStatus() {
        // OOD连接状态信息
        let ood_status = await this.m_util_service.get_ood_status({ common: { flags: 0 } });
        if (!ood_status.err) {
            ood_status = ood_status.unwrap();
        }
        console.log('ood_status:', ood_status);
        if (ood_status.cont_fail_count >= 3) {
            $('.browser_table_box').css('display', 'none');
            $('.unconnect_ood').css('display', 'block');
        }
    }

    async search_id(search_value: string) {
        document.getElementById('msg_text')!.innerHTML = '';
        if (!search_value) {
            return;
        }
        let search_id;
        if (search_value) {
            let idResult = cyfs.ObjectId.from_base_58(search_value);
            if (idResult.err) {
                toast({
                    message: LANGUAGESTYPE == 'zh'?"Id格式不对":'wrong ID format',
                    time: 1500,
                    type: 'warn'
                });
                return;
            } else {
                search_id = idResult.unwrap()
            }
        }
        const ret = await ObjectUtil.getObject({ id: search_id, isReturnResult: true })
        if (ret.err) {
            toast({
                message: LANGUAGESTYPE == 'zh'?"找不到这个对象！":'This object was not found!',
                time: 1500,
                type: 'warn'
            });
        }
        console.log('--------------ret', ret)

        document.getElementById("detail_box")!.style.display = "block";
        document.getElementById("lastest_box")!.style.display = "none";
        if (ret.err) {
            document.getElementById('object_id')!.innerHTML = "ID:" + LANGUAGESTYPE == 'zh'?"无":'Nothing';
            document.getElementById('object_type')!.innerHTML = "TYPE:" + LANGUAGESTYPE == 'zh'?"无":'Nothing';
            return;
        }
        let ret_result: cyfs.NONGetObjectOutputResponse;
        if (ret) {
            ret_result = ret;
            let ret_info: cyfs.NONObjectInfo = ret_result.object
            console.log('----------------objectid', ret_info.object)
            document.getElementById('object_id')!.innerHTML = ret_info.object?.desc().calculate_id().to_base_58() || '';
            let type = ret_info.object?.desc().obj_type_code()?cyfs.ObjectTypeCode[ret_info.object?.desc().obj_type_code()!] : '-';
            $('#object_type').html("TYPE:" + type);
            objectId = ret_info.object?.desc().calculate_id().to_base_58() || '';
            //所有者
            let owner_info: string = "-";
            if (ret_info.object?.desc().owner()) {
                owner_info = ret_info.object!.desc().owner()!.unwrap().toString();
            }
            // 区域
            let area_info = await file_info.getArea(ret_info.object?.desc());
            // nonce
            let nonce = '-';
            // if (ret_info.object.nonce().is_some()) {
            //     let nonce = ret_info.object.nonce().unwrap();
            //     console.origin.log('----------------nonce', nonce)
            // }
            let decid:string = '';
            if(ret_info.object?.desc().dec_id().is_some()){
                decid = ret_info.object?.desc().dec_id().unwrap().toString();
            }

            if(ret_info.object?.desc().calculate_id()){
                let getNftR = await this.meta_client.nft_get(ret_info.object?.desc().calculate_id().toString());
                console.log('getNftR', getNftR)
                if(!getNftR.err && getNftR.result.owner_id){
                    $('#is_nft_icon').css('display', 'block');
                }
                let getBeneficiaryR = await this.meta_client.getBeneficiary(ret_info.object?.desc().calculate_id());
                console.log('getBeneficiaryR', getBeneficiaryR)
                this.getBalance();
                if(!getBeneficiaryR.err){
                    let getBeneficiaryId = getBeneficiaryR.unwrap();
                    let current_device_static_info = await this.m_util_service.get_device_static_info({ common: { flags: 0 } });
                    let owner_id:string = '';
                    if (!current_device_static_info.err) {
                        current_device_static_info = current_device_static_info.unwrap().info;
                        owner_id = current_device_static_info.owner_id?.toString();
                    }
                    if(getBeneficiaryId.toString() == ret_info.object?.desc().calculate_id().toString()){
                        if(owner_id == owner_info){
                            $('.with_drawal_box').css('display', 'block');
                        }else{
                            $('.with_drawal_box').css('display', 'none');
                        }
                    }else{
                        console.origin.log('getBeneficiaryId', getBeneficiaryId.toString(), owner_id);
                        if(getBeneficiaryId.toString() == owner_id){
                            $('.with_drawal_box').css('display', 'block');
                        }else{
                            $('.with_drawal_box').css('display', 'none');
                        }
                    }
                }
            }
            this.getTransList();
            $('#table_obj_type').html(type);
            $('#table_obj_id').html(objectId);
            $('#table_app_id').html(decid || '-');
            $('#table_owner').html(owner_info);
            $('#table_area').html(area_info);
            $('#table_time').html(formatDate(cyfs.bucky_time_2_js_time(ret_info.object!.desc().create_time())));
            $('#table_updateTime').html(formatDate(cyfs.bucky_time_2_js_time(ret_info.object!.desc().create_time())));
            $('#table_nonce').html(nonce);
            if (ret_info.object?.desc().obj_type() == cyfs.CoreObjectType.Msg) {
                let msg_ret = (new cyfs.MsgDecoder()).raw_decode(new Uint8Array(ret_info.object_raw));
                console.log('------------msg_ret', msg_ret)
                if (msg_ret.err) {
                } else {
                    let [msg,] = msg_ret.unwrap();
                    console.log('------------msg', msg)
                    msg.desc().content().content.match({
                        Text: (text: string) => {
                            document.getElementById('msg_text')!.innerHTML = "<b>文本信息:</b>" + text;
                        }
                    });
                }
            }
        }
    }

    async getArea(desc: cyfs.ObjectDesc | any) {
        let area_info:string = LANGUAGESTYPE == 'zh' ? '其它' : 'others';
        if (desc.area()) {
            let area_unwrap = desc.area().unwrap();
            if (!area_unwrap.country && !area_unwrap.city) {
                area_info = LANGUAGESTYPE == 'zh' ? '其它' : 'others';
            } else {
                let area = desc.area().unwrap().get_area_info(LANGUAGESTYPE);
                console.log('--------------area', area)
                if (area) {
                    if (area.country_name && area.city_name) {
                        area_info = area.country_name + ',' + area.state_name + ',' + area.city_name;
                    }
                }
            }
        }
        return area_info;
    }

    async getTransList(operation?:string) {
        if(!IS_RETURN){
            IS_RETURN = true;
        }else{
            return;
        }
        if(operation == 'add'){
            TRANS_PAGE_INDEX ++ ;
        }else if(operation == 'reduce'){
            TRANS_PAGE_INDEX -- ;
        }
        // let txLists = (await this.meta_client.getCollectTxList([objectId], TRANS_PAGE_INDEX*10, 10, null, null, ["0", "1"]))?.result;
        let txLists = (await this.meta_client.getCollectTxList([objectId], 0, 50, null, null, ["0", "1"]))?.result;
        txLists = txLists?.concat((await this.meta_client.getPaymentTxList([objectId], 0, 50, null, null, ["0", "1"]))?.result||[]);
        console.origin.log('----------txLists', txLists)
        let txHtml = '';
        if (txLists && txLists.length ) {
            let hashRouter = CHANNEL == 'beta'? 'https://beta.browser.cyfs.com/business_detail.html?':'https://dev.browser.cyfs.com/business_detail.html?';
            txLists.forEach(element => {
                txHtml += `<tr>
                                <td><a class="color_475" href="${hashRouter + element.hash}" target="_blank">${getSubStr(element.hash)}</a></td>
                                <td>${formatDate(Number(element.create_time))}</td>
                                <td>${element.desc == '转账'?TXTYPES[0][LANGUAGESTYPE]:TXTYPES[1][LANGUAGESTYPE]}</td>
                                <td><a class="color_475" href="cyfs://static/object_browser/objects.html?id=${element.from}" target="_blank">${getSubStr(element.from)}</a></td>
                                <td>100 Qiu</td>
                                <td>${castToLocalUnit(Number(element.value))} DMC</td>
                                <td>${element.result<=1 ? STATUSTYPE[element.result][LANGUAGESTYPE] : STATUSTYPE[1][LANGUAGESTYPE]}</td>
                            </tr>`;
            });
            if (TRANS_PAGE_INDEX > 0 && $('.page_div_container span').eq(TRANS_PAGE_INDEX).siblings().length < TRANS_PAGE_INDEX) {
                $('.page_div_container').append(`<span>${TRANS_PAGE_INDEX + 1}</span>`);
            }
            TX_LENGTH = txLists.length;
            $('.page_div_container span').eq(TRANS_PAGE_INDEX).addClass('choose_index').siblings().removeClass("choose_index");
            $('#browser_transactions_tbody').html(txHtml);
        }
        IS_RETURN = false;
    }

    async getBalance() {
        let balance = castToLocalUnit(Number((await this.meta_client.getBalance(0, objectId))?.result));
        $('.balance_content').html(balance + 'DMC');
    }
    
}
const file_info = new FileInfo();

function jump_Route(value: string) {
    file_info.search_id(value);
}

async function on_query() {
    let select_value = $('#search_box_select').val();
    let search_box_value = $('#search_box_txt').val()?.toString();
    console.log('search_box_value', search_box_value)

    PAGE_INDEX = 0;
    RET_OBJECTS = [];
    REQ_PARAMS = {
        filter: {
            insert_time: undefined,
            owner_id: undefined
        },
        opt: undefined,
        common: {
            level: cyfs.NONAPILevel.Router,
            flags: 0
        }
    };
    document.getElementById('page_div')!.innerHTML = '<span class="choose_index">1</span>';
    document.getElementById('page_div')!.style.left = '0';
    if (!search_box_value) {
        await objectManager.fetchObjects();
        return;
    }
    if (select_value == 1 && search_box_value) {
        if (ISPC) {
            window.location.href = 'cyfs://static/object_browser/objects.html?id=' + search_box_value;
        } else {
            window.location.href = 'cyfs://static/mobile/objects.html?id=' + search_box_value;
        }
    } else if (select_value == 2) {
        $('#detail_box').css('display', 'none');
        $('#lastest_box').css('display', 'block');
        await objectManager.fetchObjects(search_box_value);
    }
}


async function nextPage(isNext: boolean) {
    if (isNext) {
        if (RET_OBJECTS.length % 10 == 0 && RET_OBJECTS.length != 0) {
            PAGE_INDEX++;
        } else {
            return;
        }
    } else {
        if (PAGE_INDEX >= 1) {
            PAGE_INDEX--;
        } else {
            return;
        }
    }

    let pageBox = document.getElementById('page_div')!;
    let elem_child = pageBox.childNodes;
    for (var i in elem_child) {
        if (elem_child[i].nodeName == "#text" && !/\S/.test(elem_child[i].nodeValue || '')) {
            pageBox.removeChild(elem_child[i]);
        }
    }
    if (elem_child) {
        let leftLocation = Number(pageBox.style.left.substring(0, pageBox.style.left.indexOf('r')));
        if (isNext) {
            $('#page_div span').eq(PAGE_INDEX - 1).removeClass("choose_index");
            if (elem_child.length < PAGE_INDEX + 1) {
                let sp = document.createElement('span');
                sp.innerHTML = (PAGE_INDEX + 1).toString();
                sp.classList.add('choose_index');
                pageBox.appendChild(sp);
            } else {
                $('#page_div span').eq(PAGE_INDEX).addClass("choose_index");
            }
            if (ISPC) {
                if (pageBox.offsetLeft <= 0 && PAGE_INDEX > 8) {
                    pageBox.style.left = (pageBox.offsetLeft - 32) + 'px';
                }
            } else {
                pageBox.style.left = (leftLocation - 0.32) + 'rem';
            }
        } else {
            if (PAGE_INDEX >= 0) {
                $('#page_div span').eq(PAGE_INDEX + 1).removeClass("choose_index");
                $('#page_div span').eq(PAGE_INDEX).addClass("choose_index");
                if (ISPC) {
                    if (pageBox.offsetLeft < 0) {
                        pageBox.style.left = (pageBox.offsetLeft + 32) + 'px';
                    }
                } else {
                    if (pageBox.offsetLeft < 0) {
                        pageBox.style.left = (leftLocation + 0.32) + 'rem';
                    }
                }
            }
        }
    } else {
        pageBox.innerHTML = '<span class="choose_index">1</span>'
    }
    let option = {
        page_index: PAGE_INDEX,
        page_size: 10
    }
    REQ_PARAMS.opt = option;
    console.log('-----------------PAGE_INDEX', PAGE_INDEX)
    objectManager.fetchObjects(undefined, true);
}

var file = '';
var file_id = '';
var file_type = '';
function initData() {
    if (window.location.search.split("?")[1]) {
        file = window.location.search.split("?")[1];
        if (file) {
            file_type = file.split('=')[0];
            file_id = file.split('=')[1];
            console.log('----------file_type', file_type, file_type == 'owner', file_type && file_type == 'owner')
            if (file_type && file_type == 'owner') {
                console.log('----------file_type', file_id)
                objectManager.fetchObjects(file_id);
            } else {
                jump_Route(file_id);
            }
        }
    } else {
        if(!ANONYMOUS_STATUS){
            objectManager.fetchObjects();
        }
    }
}

let ANONYMOUS_STATUS:boolean;
$.ajax({
    url: 'http://127.0.0.1:38090/status',
    success:function(result){
        console.log('getStatus-result', result);
        ANONYMOUS_STATUS = result.anonymous;
        CHANNEL = result.channel;
        if(result.anonymous){
            $('.anonymous_box').css('display', 'block');
            $('.search_box').css('display', 'none');
            $('.search_box_txt').attr('disabled', 'disabled');
        }
        if (!result.is_bind) {
        } else {
            // $('.browser_table_box').css('display', 'none');
            // $('.unconnect_ood').css('display', 'block');
        }
        file_info.getOodStatus()
        initData();
    }
});

$('.anonymous_subtitle').on('click', async function () {
    window.open('cyfs://static/guide.html');
})

$('.search_txt_box').on('click', () => {
    if(ANONYMOUS_STATUS){
        toast({
            message: LANGUAGESTYPE == 'zh'?"当前为匿名模式，不可使用该功能！":'Currently in anonymous mode, this feature is not available!',
            time: 1500,
            type: 'warn'
        });
    }
})

function handleObject(){
    let type = $('.browser_filter_type_ul .browser_filter_active').attr("data-type");
    let attrType = $('.browser_filter_attr_ul .browser_filter_active').attr("data-attr");
    let filterObjects: { id: string, type: cyfs.ObjectTypeCode | undefined, owner_info:string, time: cyfs.JSBI, decid: string, nftIcon: string }[] = [];
    if(type){
        console.origin.log('------------------ALL_OBJECT', ALL_OBJECT)
        if(type == 'all' && attrType == 'all'){
            filterObjects = ALL_OBJECT;
        }else{
            ALL_OBJECT.forEach((element)=>{
                if(type != 'all' && attrType == 'all' && type == element.type){
                    filterObjects.push(element);
                }else if(type == 'all' && attrType == 'nft' && element.nftIcon){
                    filterObjects.push(element);
                }else if(type == element.type && attrType == 'nft' && element.nftIcon){
                    filterObjects.push(element);
                }
            })
        }
    }
    handleObjectRender(filterObjects);
}

$('.browser_filter_ul li').on('click', function () {
    $(this).siblings("li").removeClass("browser_filter_active");
    $(this).addClass('browser_filter_active');
    handleObject();
})
$('.browser_search').on('click', () => {
    on_query()
})



// $('.trans_page_box .first_page, .trans_page_box .last_page_btn').on('click', () => {
//     if(TRANS_PAGE_INDEX > 0){
//         file_info.getTransList('reduce');
//     }
// })

// $('.trans_page_box .last_page, .trans_page_box .next_page_btn').on('click', () => {
//     if(TX_LENGTH == 10){
//         file_info.getTransList('add');
//     }
// })

$('.object_page_box .first_page').on('click', () => {
    nextPage(false)
})

$('.object_page_box .last_page_btn').on('click', () => {
    nextPage(false)
})

$('.object_page_box .last_page').on('click', () => {
    nextPage(true)
})

$('.object_page_box .next_page_btn').on('click', () => {
    nextPage(true)
})

$('#search_box_txt').on('keydown', (event) => {
    if (event.keyCode == 13) { on_query() }
})

$('.date_input_box_span').on('click', function () {
    if (!ISPC) {
        $(this).next('input')[0].focus();
        $(this).next('input')[0].click();
    }
})
$('body').on('input propertychange', '#start_Time, #end_Time', function (event) {
    if (!ISPC) {
        if (!$(this)[0].value) {
            console.log(', $(this)', $(this).prev('span'))
            $(this).prev('span').css('display', 'block');
        } else {
            $(this).prev('span').css('display', 'none');
        }
    }
});

$('.browser_back_index').on('click', function () {
    if(!ANONYMOUS_STATUS){
        window.location.href = './objects.html';
    }
})

$('.browser_table_title').on('click', ".with_drawal_btn, .tipping_btn",async function () {
    $('.objects_cover_box').css('display', 'block');
    $('#objects_cover_scan').html('');
    QRCode.toCanvas(document.getElementById('objects_cover_scan'), objectId, {
        errorCorrectionLevel: 'L',
        width: 200,
        height: 200,
        margin: 0
    });
})

$('.objects_cover_box').on('click', function () {
    $('.objects_cover_box').css('display', 'none');
})
