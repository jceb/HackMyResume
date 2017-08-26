###*
Definition of the HtmlPdfCLIGenerator class.
@module generators/html-pdf-generator.js
@license MIT. See LICENSE.md for details.
###



TemplateGenerator = require './template-generator'
FS = require 'fs-extra'
PATH = require 'path'
SLASH = require 'slash'
_ = require 'underscore'
HMSTATUS = require '../core/status-codes'
SPAWN = require '../utils/safe-spawn'
HTMLPDF = require 'puppeteer'


###*
An HTML-driven PDF resume generator for HackMyResume. Talks to Phantom,
wkhtmltopdf, and other PDF engines over a CLI (command-line interface).
If an engine isn't installed for a particular platform, error out gracefully.
###

module.exports = class HtmlPdfCLIGenerator extends TemplateGenerator



  constructor: () -> super 'pdf', 'html'



  ###* Generate the binary PDF. ###
  onBeforeSave: ( info ) ->
    #console.dir _.omit( info, 'mk' ), depth: null, colors: true
    return info.mk if info.ext != 'html' and info.ext != 'pdf'
    safe_eng = info.opts.pdf || 'wkhtmltopdf'
    safe_eng = 'phantomjs' if safe_eng == 'phantom'
    if _.has engines, safe_eng
      @errHandler = info.opts.errHandler
      engines[ safe_eng ].call @, info.mk, info.outputFile, info.opts, @onError
      return null # halt further processing



  ### Low-level error callback for spawn(). May be called after HMR process
  termination, so object references may not be valid here. That's okay; if
  the references are invalid, the error was already logged. We could use
  spawn-watch here but that causes issues on legacy Node.js. ###
  onError: (ex, param) ->
    param.errHandler?.err? HMSTATUS.pdfGeneration, ex
    return



# TODO: Move each engine to a separate module
engines =



  ###*
  Generate a PDF from HTML using wkhtmltopdf's CLI interface.
  Spawns a child process with `wkhtmltopdf <source> <target>`. wkhtmltopdf
  must be installed and path-accessible.
  TODO: If HTML generation has run, reuse that output
  TODO: Local web server to ease wkhtmltopdf rendering
  ###
  wkhtmltopdf: (markup, fOut, opts, on_error) ->
    # Save the markup to a temporary file
    tempFile = fOut.replace /\.pdf$/i, '.pdf.html'
    FS.writeFileSync tempFile, markup, 'utf8'

    # Prepare wkhtmltopdf arguments.
    wkhtmltopdf_options = _.extend(
      {'margin-bottom': '10mm', 'margin-top': '10mm'}, opts.wkhtmltopdf)
    wkhtmltopdf_options = _.flatten(_.map(wkhtmltopdf_options, (v, k)->
      return ['--' + k, v]
    ))
    wkhtmltopdf_args = wkhtmltopdf_options.concat [ tempFile, fOut  ]

    SPAWN 'wkhtmltopdf', wkhtmltopdf_args , false, on_error, @
    return



  ###*
  Generate a PDF from HTML using Phantom's CLI interface.
  Spawns a child process with `phantomjs <script> <source> <target>`. Phantom
  must be installed and path-accessible.
  TODO: If HTML generation has run, reuse that output
  TODO: Local web server to ease Phantom rendering
  ###
  phantomjs: ( markup, fOut, opts, on_error ) ->
    # Save the markup to a temporary file
    tempFile = fOut.replace /\.pdf$/i, '.pdf.html'
    FS.writeFileSync tempFile, markup, 'utf8'
    scriptPath = PATH.relative process.cwd(), PATH.resolve( __dirname, '../utils/rasterize.js' )
    scriptPath = SLASH scriptPath
    sourcePath = SLASH PATH.relative( process.cwd(), tempFile)
    destPath = SLASH PATH.relative( process.cwd(), fOut)
    SPAWN 'phantomjs', [ scriptPath, sourcePath, destPath ], false, on_error, @
    return

  ###*
  Generate a PDF from HTML using WeasyPrint's CLI interface.
  Spawns a child process with `weasyprint <source> <target>`. Weasy Print
  must be installed and path-accessible.
  TODO: If HTML generation has run, reuse that output
  ###
  weasyprint: ( markup, fOut, opts, on_error ) ->
    # Save the markup to a temporary file
    tempFile = fOut.replace /\.pdf$/i, '.pdf.html'
    FS.writeFileSync tempFile, markup, 'utf8'

    SPAWN 'weasyprint', [tempFile, fOut], false, on_error, @
    return

  ###*
  Generate a PDF from HTML using headless google chome (v59 or newer).
  Google Chrome must be installed and path-accessible.
  ###
  chrome: ( markup, fOut, opts, on_error ) ->
    # Prepare wkhtmltopdf arguments.
    # For all launch options see https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#puppeteerlaunchoptions
    # For all pdf options see https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pagepdfoptions
    chrome_launch_options = _.extend({}, opts.chrome.launch)
    chrome_pdf_options = _.extend(
      {
          'path': fOut,
          'landscape': false,
          'displayHeaderFooter': false,
          'printBackground': false,
          'format': "A4",
          'scale': 1,
          'width': '8.5in',
          'height': '11in',
          'pageRanges': '',
          'margin': {
              'top': '0.4in',
              'bottom': '0.56in',
              'left': '0.4in',
              'right':' 0.4in'
          }
      }, opts.chrome.pdf)
    tempFile = fOut.replace /\.pdf$/i, '.pdf.html'
    FS.writeFileSync tempFile, markup, 'utf8'
    HTMLPDF.launch(chrome_launch_options).then((browser) ->
      browser.newPage().then((page) ->
        page.goto('file://' + tempFile, {waitUntil: 'networkidle'}).then((response) ->
          page.pdf(chrome_pdf_options).then((buffer) ->
              browser.close()
          )
        )
      )
    )
    return
