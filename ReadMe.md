# VuePress 图片下载工具

分析 VuePress 文档中的图片链接并下载,可将图片转码为 Avif 格式,更加节省空间

![preview](preview.png)

```powershell
Description:
  VuePress 图片下载工具 —— 分析 VuePress 文档中的图片链接并下载,可将图片转码为 Avif 格式,更加节省空间

Usage:
  vuepress-image [Options]

Options:
  -d, --doc_dir <doc_dir>  MD文档存放文件夹 [default: src]
  -i, --img_dir <img_dir>  图片存放文件夹 [default: src\.vuepress\public]
  -n, --no_convert         不转换图片格式为 Avif [default: False]
  -v, --version            当前版本号
  -h, --help               显示帮助信息

Examples:
vuepress-image -d src -i src\.vuepress\public
vuepress-image -n
```

## 使用方法

在文档的根目录下运行以下命令

```powershell
vuepress-image
```

如果您的目录结构不同,请使用 `-d` 和 `-i` 参数指定文档和图片的目录

```powershell
vuepress-image -d src -i src\.vuepress\public
```

如果您不想将图片转码为 Avif 格式,请使用 `-n` 参数

```powershell
vuepress-image -c
```


### 查看帮助

```powershell
vuepress-image -h
```