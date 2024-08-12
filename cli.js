#!/usr/bin/env node
'use strict'
const info = require('./package.json')
const minimist = require('minimist')
const fs = require('fs')
const AdmZip = require('adm-zip')
const path = require('path')
const axios = require('axios')
const { exec } = require('child_process')
var styles = {
	'reset': '\x1B[0m',
	'bright': '\x1B[1m',
	'grey': '\x1B[2m',
	'italic': '\x1B[3m',
	'underline': '\x1B[4m',
	'reverse': '\x1B[7m',
	'hidden': '\x1B[8m',
	'black': '\x1B[30m',
	'red': '\x1B[31m',
	'green': '\x1B[32m',
	'yellow': '\x1B[33m',
	'blue': '\x1B[34m',
	'magenta': '\x1B[35m',
	'cyan': '\x1B[36m',
	'white': '\x1B[37m',
	'blackBG': '\x1B[40m',
	'redBG': '\x1B[41m',
	'greenBG': '\x1B[42m',
	'yellowBG': '\x1B[43m',
	'blueBG': '\x1B[44m',
	'magentaBG': '\x1B[45m',
	'cyanBG': '\x1B[46m',
	'whiteBG': '\x1B[47m'
}

function colors(keys, source) {
	var values = ''
	if(typeof keys === 'string'){
			values = styles[keys]
	}
	else {
			keys.forEach(key => {
					values += styles[key]
			});
	}
	return values + source + styles['reset']
}
var args = minimist(process.argv.slice(2), {
	alias: {
		d: 'doc_dir',
		i: 'img_dir',
		n: 'no_convert',
		h: 'help',
		v: 'version',
	},
})
function help() {
	var help = `Description:
  VuePress 图片下载工具 —— 分析 VuePress 文档中的图片链接并下载,可将图片转码为 Avif 格式,更加节省空间

Usage:
  ${info.name} [Options]

Options:
  -d, --doc_dir <doc_dir>  MD文档存放文件夹 [default: src]
  -i, --img_dir <img_dir>  图片存放文件夹 [default: src\\.vuepress\\public]
  -n, --no_convert         不转换图片格式为 Avif [default: False]
  -v, --version            当前版本号
  -h, --help               显示帮助信息

Examples:
${info.name} -d src -i src\\.vuepress\\public
${info.name} -n

ITLDG home page: <https://www.itldg.com>`

	console.log(help)
	process.exit()
}

function version() {
	console.log(`${info.name}  ${info.version}  (c) 2024 ${info.author}`)
	process.exit()
}

/**
 * 清空当前行
 * @return {*}
 */
function clearLine() {
	process.stdout.clearLine() // 清空整行
	process.stdout.cursorTo(0) // 将光标移动到行首
}

/**
 * 在当前行打印消息
 * @param {String} msg 消息
 */
function printCurrrLine(msg) {
	clearLine()
	process.stdout.write(msg)
}

/**
 * 下载文件到本地
 * @param {*} url 下载地址
 * @param {*} savePath 保存路径
 * @return {*} Promise
 */
function downloadFile(url, savePath) {
	return new Promise((resolve, reject) => {
		axios({
			url: url,
			method: 'GET',
			responseType: 'stream',
			ssl: { rejectUnauthorized: false },
			onDownloadProgress: (progressEvent) => {
				if (!progressEvent.lengthComputable) {
					//暂时不可计算进度
					return
				}
				const percent = ((progressEvent.loaded / progressEvent.total) * 100).toFixed(2)
				printCurrrLine(`Downloading... ${colors('cyan', `${percent}%`)}\r`)
			},
		})
			.then((response) => {
				const writer = fs.createWriteStream(savePath)
				response.data.pipe(writer)

				writer.on('finish', () => {
					clearLine()
					resolve()
				})
			})
			.catch((error) => {
				// console.error('Download failed', error)
				reject(error)
			})
	})
}

async function checkFFmpeg(ffmpegPath) {
	if (!fs.existsSync(ffmpegPath)) {
		console.log(colors('cyan', '首次使用图片转码功能需要下载 FFMpeg ,请稍等片刻 ...'))
		const ffmpegZip = path.join(__dirname, 'ffmpeg.zip')
		try {
			await downloadFile('https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip', ffmpegZip)
		} catch (error) {
			console.log(colors('red', '下载 ffmpeg 失败\n如多次下载失败可自行手动下载 ffmpeg.exe 放在软件目录\n错误提示: ' + error.message))
			process.exit()
		}
		const archive = new AdmZip(ffmpegZip)
		const entries = archive.getEntries()
		let isOk = false
		entries.forEach((entry) => {
			if (entry.entryName === 'ffmpeg-master-latest-win64-gpl/bin/ffmpeg.exe') {
				fs.writeFileSync(ffmpegPath, entry.getData())
				isOk = true
			}
		})
		if (isOk) {
			fs.unlinkSync(ffmpegZip)
		} else {
			console.log(colors('red', '解压 ffmpeg 失败, 请手动下载 ffmpeg.exe 放在软件目录'))
		}
	}
}
/**
 * 获取指定目录下的所有文件
 * @param {String} dir 目录
 * @param {Function} filter 过滤条件
 * @param {String[]} result 结果
 * @return {String[]} 文件列表
 */
function getFiles(dir, filter = null, result = []) {
	let files = fs.readdirSync(dir)
	files.forEach((file) => {
		let pathname = path.join(dir, file)
		if (fs.statSync(pathname).isDirectory()) {
			getFiles(pathname, filter, result)
		} else {
			if (!filter) {
				result.push(pathname)
			} else if (filter(pathname)) {
				result.push(pathname)
			}
		}
	})
	return result
}

const TempFileName = 'temp.avif'
/**
 * 转换图片为 Avif 格式
 * @param {*} ffmpegPath ffmpeg 路径
 * @param {*} inputFilePath 输入文件路径
 * @param {*} outputFilePath 输出文件路径
 * @param {*} CompareSizes 是否比较大小
 * @return {*} Promise
 */
function convertToAvif(ffmpegPath, inputFilePath, outputFilePath, CompareSizes = true) {
	if (!inputFilePath) {
		return false
	}
	if (fs.existsSync(TempFileName)) {
		fs.unlinkSync(TempFileName)
	}
	return new Promise((resolve, reject) => {
		const args = `-y -i ${inputFilePath} -c:v libaom-av1 ${TempFileName}`
		exec(`${ffmpegPath} ${args}`, (error, stdout, stderr) => {
			if (error) {
				reject(error)
				return
			}
			if (!CompareSizes) {
				fs.renameSync(TempFileName, outputFilePath)
				resolve()
				return
			}
			const inputFileInfo = fs.statSync(inputFilePath)
			const outputFileInfo = fs.statSync(TempFileName)
			if (inputFileInfo.size <= outputFileInfo.size) {
				fs.unlinkSync(TempFileName)
				resolve()
				return
			}
			fs.renameSync(TempFileName, outputFilePath)
			resolve()
		})
	})
}

async function init(args) {
	if (!args.doc_dir) {
		args.doc_dir = 'src'
	}
	if (!args.img_dir) {
		args.img_dir = 'src\\.vuepress\\public'
	}
	let doc_dir = path.join(process.cwd(), args.doc_dir)
	if (!fs.existsSync(doc_dir)) {
		console.log(colors('red', '文档目录不存在,请确认是在文档根目录执行或自行指定文档目录'))
		process.exit()
	}

	let img_dir = path.join(process.cwd(), args.img_dir)
	if (!fs.existsSync(img_dir)) {
		console.log(colors('red', '图片目录不存在,请确认是在文档根目录执行或自行指定图片目录'))
		process.exit()
	}

	if (!doc_dir.endsWith('\\')) {
		doc_dir += '\\'
	}
	if (!img_dir.endsWith('\\')) {
		img_dir += '\\'
	}
	const ffmpegPath = path.join(__dirname, 'ffmpeg.exe')
	if (!args.no_convert) {
		await checkFFmpeg(ffmpegPath)
	}
	let imgCount = 0
	let docFiles = getFiles(doc_dir, (file) => file.endsWith('.md'))
	const numLength = docFiles.length.toString().length
	for (let i = 0; i < docFiles.length; i++) {
		printCurrrLine(`[${(i + 1).toString().padStart(numLength, '0')}/${docFiles.length}] ${colors('cyan', `${docFiles[i].replace(doc_dir, '')}`)}`)
		const docFile = docFiles[i]
		const dirName = path.dirname(docFile)
		const saveImgDirName = `images\\${dirName.replace(doc_dir, '')}`
		let docContent = fs.readFileSync(docFile, 'utf-8')
		const matches = docContent.matchAll(/!\[.*?\]\((.*?)\)/g)
		let hasImg = false
		for (const match of matches) {
			const imgUrl = match[1]
			if (!imgUrl.startsWith('http://') && !imgUrl.startsWith('https://') && !imgUrl.startsWith('//')) {
				continue
			}
			if (imgUrl.startsWith('//')) {
				imgUrl = 'https:' + imgUrl
			}
			let imgName = path.basename(imgUrl)
			imgName = imgName.replace(/(\.\w+)[^\w].*/, '$1')
			const imgFileDir = path.join(img_dir, saveImgDirName)
			if (!fs.existsSync(imgFileDir)) {
				fs.mkdirSync(imgFileDir, { recursive: true })
			}
			if (imgName.includes('?')) {
				imgName = imgName.substring(0, imgName.indexOf('?')) + '.png'
			}
			const imgPath = path.join(imgFileDir, imgName)
			if (fs.existsSync(imgPath)) {
				continue
			}
			if (!hasImg) {
				hasImg = true
				console.log()
			}
			const imgDocFileName = '/' + path.join(saveImgDirName, imgName).replace(/\\/g, '/')
			try {
				await downloadFile(imgUrl, imgPath)
				if (!args.no_convert) {
					try {
						printCurrrLine(`Converting image to Avif... ${imgDocFileName}\r`)
						await convertToAvif(ffmpegPath, imgPath, imgPath)
						clearLine()
					} catch (error) {
						clearLine()
						console.log('转换图片失败：', colors('red', error.message))
					}
				}
				docContent = docContent.replaceAll(imgUrl, imgDocFileName)
				imgCount++
			} catch (error) {
				console.log('下载图片失败:', colors('red', error.message))
			}
		}
		if (hasImg) {
			fs.writeFileSync(docFile, docContent)
		} else {
			clearLine()
		}
	}
	console.log(`[${docFiles.length}/${docFiles.length}] 文档分析完成,处理了 `, colors('cyan', `${imgCount}`), ' 张图片')
}
if (args.help) {
	help()
}

if (args.version) {
	version()
}
init(args)
