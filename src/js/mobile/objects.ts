
import "../../css/m_main.css"

import * as cyfs from '../../cyfs_sdk/cyfs'
import JSBI from 'jsbi';
import $ from 'jquery'
let QRCode = require('qrcode')
import { ObjectUtil, formatDate, getSubStr, hasPC } from '../lib/util'
let jsonTree = require('../../component/jsonTree')

var ISPC = hasPC();
function showScan() {
    let scanBox = document.getElementById("scan_box")!;
    if (scanBox.style.display == 'none' || scanBox.style.display == '') {
        scanBox.innerHTML = '';
        scanBox.style.display = "block";
        QRCode.toCanvas(document.getElementById("scan_box")!, objectId, {
            errorCorrectionLevel: 'L',
            width: 84,
            height: 84,
            margin: 0
        });
    } else {
        scanBox.innerHTML = ''
        scanBox.style.display = "none";
    }
}
let PAGE_INDEX = 0;
let REQ_PARAMS: cyfs.NONSelectObjectOutputRequest;
let RET_OBJECTS = [];
let objectId = "";
class ObjectManager {
    m_sharedStatck: cyfs.SharedObjectStack;
    m_router: cyfs.NONRequestor;
    constructor() {
        this.m_sharedStatck = cyfs.SharedObjectStack.open_runtime();
        this.m_router = this.m_sharedStatck.non_service();
    }

    async fetchObjects(search_value?: string, startTime?: JSBI, endTime?: JSBI, isOtherPage?: boolean) {
        RET_OBJECTS = []
        const router = this.m_router;
        let ownerId: cyfs.ObjectId | undefined;
        if (search_value) {
            let idResult = cyfs.ObjectId.from_base_58(search_value);
            if (idResult.err) {
                alert('Id格式不对');
            } else {
                ownerId = idResult.unwrap()
            }
        }
        let insertTime;

        if (startTime && endTime) {
            insertTime = new cyfs.SelectTimeRange(startTime, endTime)
        } else {
            insertTime = new cyfs.SelectTimeRange(JSBI.BigInt(0), cyfs.bucky_time_now());
            if (search_value) {
                insertTime = undefined;
            }
        }
        const option = {
            page_index: PAGE_INDEX,
            page_size: 10
        };
        let req: cyfs.NONSelectObjectOutputRequest = {
            filter: {
                insert_time: insertTime,
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
        console.log('----------------------req', req)
        const r: cyfs.BuckyResult<cyfs.NONSelectObjectOutputResponse> = await router.select_object(req);
        console.log('----------------------r ', r)
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
        console.info("objects:", objects);
        RET_OBJECTS = objects;
        if (!objects) {
            browser_tbody.innerHTML = "";
        }
        let tbody_Html = "";
        objects.forEach(async (element: { object: cyfs.AnyNamedObject | undefined, object_raw: Uint8Array | undefined }) => {
            //所有者
            let owner_info = "无";
            if (element.object?.desc().owner()) {
                console.log('----owner_info', element.object.desc().owner()?.unwrap().toString())
                owner_info = getSubStr(element.object.desc().owner()!.unwrap().toString());
            }

            // 区域
            let area_info = await file_info.getArea(element.object?.desc());
            if (ISPC) {
                tbody_Html += `<tr>
                                        <th>${owner_info}</th>
                                        <th>${formatDate(cyfs.bucky_time_2_js_time(element.object!.desc().create_time()))}</th>
                                        <th>${formatDate(cyfs.bucky_time_2_js_time(element.object!.body().unwrap().update_time()))}</th>
                                        <th style="text-decoration:underline;cursor:pointer"> <a href="cyfs://static/object_browser/objects.html?id=${element.object!.desc().calculate_id().toString()}">${getSubStr(element.object!.desc().calculate_id().toString())}</a></th>
                                        <th>${area_info}</th>
                                    </tr>`;
            } else {
                tbody_Html += `<tr>
                                        <th>${owner_info}</th>
                                        <th>${formatDate(cyfs.bucky_time_2_js_time(element.object!.body().unwrap().update_time()), true)}</th>
                                        <th style="text-decoration:underline;cursor:pointer"> <a href="cyfs://static/mobile/objects.html?id=${element.object!.desc().calculate_id().toString()}">${getSubStr(element.object!.desc().calculate_id().toString())}</a></th>
                                    </tr>`;
            }

            browser_tbody.innerHTML = tbody_Html;
        });
        document.getElementById("lastest_box")!.style.display = "block";
        document.getElementById("detail_box")!.style.display = "none";
    }

}

const objectManager = new ObjectManager();

class FileInfo {
    m_sharedStatck: cyfs.SharedObjectStack;
    m_util_service: cyfs.UtilRequestor;
    m_router: cyfs.NONRequestor;
    constructor() {
        this.m_sharedStatck = cyfs.SharedObjectStack.open_runtime();
        this.m_util_service = this.m_sharedStatck.util();
        this.m_router = this.m_sharedStatck.non_service();
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
        const object_tree_container = document.getElementById("object_tree")!;
        object_tree_container.innerHTML = "";
        document.getElementById('msg_text')!.innerHTML = '';
        if (!search_value) {
            return;
        }
        let search_id;
        if (search_value) {
            let idResult = cyfs.ObjectId.from_base_58(search_value);
            if (idResult.err) {
                alert('Id格式不对');
                return;
            } else {
                search_id = idResult.unwrap()
            }
        }
        const ret = await ObjectUtil.getObject({ id: search_id, isReturnResult: true })
        if (ret.err) {
            document.getElementById('msg_text')!.innerHTML = "<b>没有找到此对象!</b>";
        }
        console.log('--------------ret', ret)

        document.getElementById("detail_box")!.style.display = "block";
        document.getElementById("lastest_box")!.style.display = "none";
        if (ret.err) {
            document.getElementById('object_id')!.innerHTML = "ID:无";
            document.getElementById('object_type')!.innerHTML = "TYPE:无";
            return;
        }
        let ret_result: cyfs.NONGetObjectOutputResponse;
        if (ret) {
            ret_result = ret;
            let ret_info: cyfs.NONObjectInfo = ret_result.object
            console.log('----------------objectid', ret_info.object)
            document.getElementById('object_id')!.innerHTML = ret_info.object?.desc().calculate_id().to_base_58() || '';
            document.getElementById('object_type')!.innerHTML = "TYPE:" + ret_info.object?.desc().obj_type_code();
            objectId = ret_info.object?.desc().calculate_id().to_base_58() || '';
            //所有者
            let owner_info: string = "无";
            if (ret_info.object?.desc().owner()) {
                owner_info = ret_info.object!.desc().owner()!.unwrap().toString();
            }
            // 区域
            let area_info = await file_info.getArea(ret_info.object?.desc());
            // nonce
            let nonce = '--';
            // if (ret_info.object.nonce().is_some()) {
            //     let nonce = ret_info.object.nonce().unwrap();
            //     console.origin.log('----------------nonce', nonce)
            // }
            $('#table_obj_type').html(ret_info.object?.desc().obj_type_code().toString() || '');
            $('#table_obj_id').html(objectId);
            $('#table_app_id').html(ret_info.object?.desc().calculate_id().to_base_58() || '');
            $('#table_owner').html(owner_info);
            $('#table_area').html(area_info);
            $('#table_time').html(formatDate(cyfs.bucky_time_2_js_time(ret_info.object!.desc().create_time())));
            if (ret_info.object?.body().is_some()) {
                $('#table_updateTime').html(formatDate(cyfs.bucky_time_2_js_time(ret_info.object.body().unwrap().update_time())));
            } else {
                $('#table_updateTime').html('--');
            }
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
            jsonTree.jsonTree.create(ret_info, object_tree_container)
        }
    }
    async getArea(desc: cyfs.ObjectDesc | any) {
        let area_info = '其它'
        if (desc.area()) {
            let area_unwrap = desc.area().unwrap();
            if (!area_unwrap.country && !area_unwrap.city) {
                area_info = '其它';
            } else {
                let area = desc.area().unwrap().get_area_info();
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
}
const file_info = new FileInfo();

function jump_Route(value: string) {
    file_info.search_id(value);
}

async function on_query() {
    let select_value = $('#search_box_select').val();
    let search_box_value = $('#search_box_txt').val()?.toString();
    let startTime_str = $('#start_Time').val()?.toString();
    let endTime_str = $('#end_Time').val()?.toString();
    console.log('search_box_value', search_box_value)
    let startTime: JSBI | undefined = undefined;
    let endTime: JSBI | undefined = undefined;

    if (startTime_str && endTime_str) {
        let start = new Date(new Date(startTime_str.replace(/-/g, '/')).getTime());
        let end = new Date(new Date(endTime_str.replace(/-/g, '/')).getTime() + 24 * 60 * 60 * 1000 - 1);
        startTime = cyfs.bucky_time(start);
        endTime = cyfs.bucky_time(end);
    }
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
    if (!startTime_str && !endTime_str && !search_box_value) {
        await objectManager.fetchObjects();
        return;
    }
    if (startTime_str && endTime_str && !search_box_value) {
        await objectManager.fetchObjects(search_box_value, startTime, endTime);
    } else if (select_value == 1 && search_box_value) {
        if (ISPC) {
            window.location.href = 'cyfs://static/object_browser/objects.html?id=' + search_box_value;
        } else {
            window.location.href = 'cyfs://static/mobile/objects.html?id=' + search_box_value;
        }
    } else if (select_value == 2) {
        await objectManager.fetchObjects(search_box_value, startTime, endTime);
    }
}


async function nextPage(isNext: boolean) {
    if (isNext) {
        console.log('11111111111111111111111111', RET_OBJECTS.length % 10, RET_OBJECTS.length != 0, RET_OBJECTS.length)
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
    let search_box_value = ($('#search_box_txt').val() || '').toString().trim();
    let startTime = $('#start_Time').val();
    let endTime = $('#end_Time').val();
    if (!search_box_value && !startTime && !endTime) {
        REQ_PARAMS.filter.insert_time = undefined;
    }
    console.log('-----------------PAGE_INDEX', PAGE_INDEX)
    objectManager.fetchObjects(undefined, undefined, undefined, true);
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
        objectManager.fetchObjects();
    }
}

var url = 'http://127.0.0.1:1321/check';
var ajax = new XMLHttpRequest();
ajax.open('get', url, true);
ajax.send();
ajax.onreadystatechange = function () {
    if (ajax.readyState == 4 && ajax.status == 200) {
        const result = JSON.parse(ajax.responseText)
        if (result.activation) {
            file_info.getOodStatus()
            initData();
        } else {
            $('.browser_table_box').css('display', 'none');
            $('.unconnect_ood').css('display', 'block');
        }
    }
}


$('.browser_search').on('click', () => {
    on_query()
})

$('.first_page').on('click', () => {
    nextPage(false)
})

$('.last_page_btn').on('click', () => {
    nextPage(false)
})

$('.last_page').on('click', () => {
    nextPage(true)
})

$('.next_page_btn').on('click', () => {
    nextPage(true)
})

$('#object_id_icon').on('click', () => {
    showScan()
})


$('#search_box_txt').on('keydown', (event) => {
    if (event.keyCode == 13) { on_query() }
})


$('.look_more_detail_i, .look_more_detail_span').on('click', () => {
    let moreDetail = $('#object_tree').css('display');
    if (moreDetail == '' || moreDetail == 'none') {
        $('#object_tree').css('display', 'block');
    } else {
        $('#object_tree').css('display', 'none');
    }
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
