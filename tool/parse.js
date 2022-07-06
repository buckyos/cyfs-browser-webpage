const fs =require('fs')
const { parse }  =require ('node-html-parser')
// const cheerio = require('cheerio');
const path = require('path')
// var jsdom = require("node-jsdom");

// jsdom.env("", function(err, window) {
//   if (err) {
//     console.error(err);
//     return;
//   }
//   var $ = require("jquery")(window);

//   const content = fs.readFileSync('./object_browser/object.html')

//   $("body").append(content);
//   console.log($("body").html());
// });

async function readAllHtml(targetDir) {
  const resp = fs.readdirSync(targetDir)
  let result = []

  for ( var i in resp ) {
    const currentPath = path.join(targetDir, resp[i])
    const stat = fs.statSync(currentPath)
    if ( stat.isFile() ) {
      const ext = path.extname(currentPath)
      if (ext == ".html") {
        result.push(currentPath)
      }
    } else if (stat.isDirectory()) {
      // const tmpResult = await readAllHtml(currentPath)
      // result = result.concat(tmpResult)
    }
  }

  return result
}


async function main() {
  // 拿到所有html
  let allHtmlFilePath = []
  allHtmlFilePath = allHtmlFilePath.concat(await readAllHtml("./src"))

  const resultWithJs = {}
  for (var index in allHtmlFilePath) {
    const html = allHtmlFilePath[index]
    const content = htmlFileHandler(html)
    resultWithJs[html] = {
      eventScript: content[0],
      script: content[1],
    }
  }

  for ( var html in resultWithJs ) {
    const js = resultWithJs[html]
    // const name = path.basename(html)
    const name = path.parse(html).name;     //=> "hello"
    // const dir = path.dirname()
    const jsPath = `./src/js/${name}.js`
    fs.writeFileSync(jsPath, `${js.script}  

  // auto add event
${js.eventScript}`)
    name
  }

  resultWithJs
}

function  htmlFileHandler(filePath) {
  const tmp = `
    $('{%el}').on('{%event}', (event) => {
      {%fn}
    })
  `
  // const content = fs.readFileSync('./src/object_browser/objects.html')

  const content = fs.readFileSync(filePath)
  const root = parse(content)

  const eventFunc = (eventName) => {
    const jsEventScript =  root.querySelectorAll(`[on${eventName}]`).reduce((all,el) => {
      console.log(el.getAttribute("id"))
      console.log(el.getAttribute("class"))

      if ( el.getAttribute("on" + eventName) == '' ) {
        return all + ''
      }

      let resp
      // if
      if (el.getAttribute("id")) {
        resp = tmp
            .replace("{%el}", `#${el.getAttribute("id")}`)
            .replace('{%event}', eventName)
            .replace('{%fn}', el.getAttribute("on" + eventName))
        // console.log(resp)
      } else if (el.getAttribute("class")) {
        resp = tmp
            .replace("{%el}", `.${el.getAttribute("class")}`)
            .replace('{%event}', eventName)
            .replace('{%fn}', el.getAttribute("on" + eventName))
      }
      return all + resp
    }, '')
    return jsEventScript
  }

  const jsEventScript1 = eventFunc('click')
  const jsEventScript2 = eventFunc('keydown')

  const jsEventScript = jsEventScript1 + jsEventScript2


  const initScript = `import * as cyfs from '../cyfs_sdk/cyfs'
 `
  const scriptContent = root.querySelectorAll('script').filter(el => {
    const src = el.getAttribute("src")
    return src == '' || src == undefined
  }).reduce((scriptContent, el, index) => {
    const content = el.innerHTML
    return `${scriptContent}
// script scop ${index}
${content}
`
  }, initScript)


  return [
    jsEventScript,
    scriptContent
  ]
}

main()