import $ from 'jquery';
import * as cyfs from '../cyfs_sdk/cyfs'
let QRCode = require('qrcode')
import { toast } from './lib/toast.min'
import { ObjectUtil, formatDate, LANGUAGESTYPE, castToLocalUnit } from './lib/util'
import { getCountryList } from './lib/WorldArea'

let g_mnemonicList:string[] = [];
let g_areaList: {
    id:string,
    cname:string,
    name:string,
    states:{
        id:string,
        cname:string,
        name:string,
        cities:{
            id:string,
            cname:string,
            name:string,
        }[]
    }[]
}[] = [];
let g_ip:string = '';
let g_token:string = '';
let g_isCallArea:boolean = false;

if (window.location.search.split("?")[1]) {
    let str = window.location.search.split("?")[1];
    let arr = str.split('&');
    if (arr) {
        for (let i = 0; i < arr.length; i++) {
            if (arr[i].indexOf('=') > -1 && arr[i].split('=')[1] && arr[i].split('=')[0] == 'accessToken') {
                g_token = arr[i].split('=')[1];
            }
            if (arr[i].indexOf('=') > -1 && arr[i].split('=')[1] && arr[i].split('=')[0] == 'ip') {
                g_ip = arr[i].split('=')[1];
            }
        }
    }
}

$(async function(){
    if(LANGUAGESTYPE == 'zh'){
        $('title').html('创建DID');
    }else{
        $('title').html('Build DID');
    }
});

// header render
ObjectUtil.renderHeaderInfo();

$('.app_header_box').on('click', '.people_head_sculpture', function () {
    window.location.href = 'cyfs://static/info.html';
})

class BuildDid {
    m_sharedStatck: cyfs.SharedCyfsStack;
    m_router: cyfs.NONRequestor;
    m_util_service: cyfs.UtilRequestor;
  
    constructor() {
      this.m_sharedStatck = cyfs.SharedCyfsStack.open_runtime();
      this.m_router = this.m_sharedStatck.non_service();
      this.m_util_service = this.m_sharedStatck.util();
    }

    async createMnemonic () {
        let mnemonic = cyfs.bip39.generateMnemonic(128, undefined, cyfs.bip39.wordlists.english)
        console.origin.log("gen mnemonic:", mnemonic);
        let mnemonicList:string[] = [];
        if(mnemonic){
            mnemonicList = mnemonic.split(" ");
            console.origin.log("gen mnemonicList:", mnemonicList);
        }
        return mnemonicList;
    }

    async getAreaList () {
        g_areaList = await getCountryList(LANGUAGESTYPE);
        console.origin.log("g_areaList:", g_areaList);
    }

    async RenderArea () {
        if(!g_areaList.length){
            await this.getAreaList();
        }
        let countryHtml:string = '';
        let stateHtml:string = '';
        let cityHtml:string = '';
        g_areaList.forEach((area, index)=>{
            countryHtml += `<option value="${area.id}">${LANGUAGESTYPE == 'zh'?area.cname:area.name}</option>`;
            if(index === 0){
                for (let i = 0; i < area.states.length; i++) {
                    const element = area.states[i];
                    stateHtml += `<option value="${element.id}">${LANGUAGESTYPE == 'zh'?element.cname:element.name}</option>`;
                    if(i === 0){
                        for (let k = 0; k < element.cities.length; k++) {
                            const city = element.cities[k];
                            cityHtml += `<option value="${city.id}">${LANGUAGESTYPE == 'zh'?city.cname:city.name}</option>`;
                        }
                    }
                }
            }
        })
        $('#country_select').html(countryHtml);
        $('#state_select').html(stateHtml);
        $('#city_select').html(cityHtml);
    }

}

$('#country_select').on('change', function () {
    let country = $(this).val();
    let stateHtml:string = '';
    let cityHtml:string = '';
    g_areaList.forEach((area, index)=>{
        if(country === area.id){
            for (let i = 0; i < area.states.length; i++) {
                const element = area.states[i];
                stateHtml += `<option value="${element.id}">${LANGUAGESTYPE == 'zh'?element.cname:element.name}</option>`;
                if(i === 0){
                    for (let k = 0; k < element.cities.length; k++) {
                        const city = element.cities[k];
                        cityHtml += `<option value="${city.id}">${LANGUAGESTYPE == 'zh'?city.cname:city.name}</option>`;
                    }
                }
            }
        }
    })
    $('#state_select').html(stateHtml);
    $('#city_select').html(cityHtml);
})

$('#state_select').on('change', function () {
    let country = $('#country_select').val();
    let state = $(this).val();
    let cityHtml:string = '';
    g_areaList.forEach((area, index)=>{
        if(country === area.id){
            for (let i = 0; i < area.states.length; i++) {
                const element = area.states[i];
                if(state === element.id){
                    for (let k = 0; k < element.cities.length; k++) {
                        const city = element.cities[k];
                        cityHtml += `<option value="${city.id}">${LANGUAGESTYPE == 'zh'?city.cname:city.name}</option>`;
                    }
                }
            }
        }
    })
    $('#city_select').html(cityHtml);
})

function lenghtstr(str:string){
    var realLength = 0, len = str.length, charCode = -1;
    for (var i = 0; i < len; i++) {
        charCode = str.charCodeAt(i);
        if (charCode >= 0 && charCode <= 128)
            realLength += 1;
        else
            realLength += 2;
    }
    return realLength;
}

let buildDid = new BuildDid();
buildDid.getAreaList();

if(g_token && g_ip){
    $('.create_did_step_one_box').css('display', 'none');
    $('.create_did_step_two_box, .create_did_step_two').css('display', 'block');
    buildDid.RenderArea();
}

$('.cover_box').on('click', '.close_cover_i, .did_warn_btn_no', function () {
    $('.cover_box').css('display', 'none');
})

$('.cover_box').on('click', '.close_cover_i, .did_warn_btn_yes', function () {
    $('.cover_box, .did_mnemonic_create').css('display', 'none');
    $('.did_mnemonic_choose').css('display', 'block');
    let mnemonicHtml:string = '';
    g_mnemonicList.forEach(mnemonic=>{
        mnemonicHtml += `<span>${mnemonic}</span>`;
    });
    $('.did_choose_mnemonic_container').html(mnemonicHtml);
})

$('.create_did_container').on('click', '.did_next_btn', function () {
    let last = $(this).attr('data-last');
    let next = $(this).attr('data-next');
    if(last){
        $(''+last).css('display', 'none');
    }
    if(next){
        $(''+next).css('display', 'block');
    }
})

$('.did_buy_ood_btn').on('click', async function () {
    window.location.href = 'https://vfoggie.fogworks.io/?url=cyfs://static/build_did.html&desc=#/login';
})

$('.create_did_container').on('click', '.create_mnemonic_btn', async function () {
    let didName = String($('.did_info_name').val()).trim() || '';
    let oodName = String($('.did_info_ood_name').val()).trim() || '';
    console.origin.log('------didName, oodName',didName, oodName)
    if(!didName || !oodName){
        toast({
            message: LANGUAGESTYPE == 'zh'?"信息没有填写完成": 'Name cannot exceed 100 characters.',
            time: 1500,
            type: 'warn'
        });
        return;
    }
    if(didName && lenghtstr(didName) > 16){
        toast({
            message: LANGUAGESTYPE == 'zh'?"名称不可以超过16个字符": 'Nickname cannot exceed 16 characters.',
            time: 1500,
            type: 'warn'
        });
        return;
    }
    let mnemonicList:string[] = await buildDid.createMnemonic();
    let mnemonicHtml:string = '';
    mnemonicList.forEach(mnemonic=>{
        mnemonicHtml += `<span>${mnemonic}</span>`;
    });
    $('.did_create_mnemonic_box_show').html(mnemonicHtml);
    g_mnemonicList = mnemonicList.sort(function(a,b){ return Math.random()>.5 ? -1 : 1;});
    console.origin.log("gen g_mnemonicList:", g_mnemonicList);
})

$('.did_choose_mnemonic_container').on('click', 'span', function () {
    $(this).remove();
    let mnemonicHtml = `<span>${$(this).html() }</span>`;
    $('.did_choose_mnemonic_box').append(mnemonicHtml);
})

$('.did_choose_mnemonic_box').on('click', 'span', function () {
    $(this).remove();
    let mnemonicHtml = `<span>${$(this).html()}</span>`;
    $('.did_choose_mnemonic_container').append(mnemonicHtml);
})

$('.did_verify_btn').on('click', function () {
    let mnemonic_Container = $('.did_choose_mnemonic_container').html();
    console.origin.log("mnemonic_Container:", mnemonic_Container);
    if(mnemonic_Container){
        toast({
            message: LANGUAGESTYPE == 'zh'?"还有助记词没有选择": 'Name cannot exceed 100 characters.',
            time: 1500,
            type: 'warn'
        });
        return;
    }
    let mnemonicString = $('.did_choose_mnemonic_box').html();
    var reg = new RegExp("<span>","g");
    var reg2 = new RegExp("</span>","g");
    let mnemonicStr = mnemonicString.replace(reg,"").replace(reg2," ");
    console.origin.log("mnemonicStr:", mnemonicStr);
})
