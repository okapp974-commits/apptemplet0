import html2canvas from 'html2canvas';

// Common Bluetooth Printer Service and Characteristic UUIDs
const PRINTER_SERVICE_UUIDS = [
  '0000ffe0-0000-1000-8000-00805f9b34fb', // Extremely common CC2541 / HM-10 BLE Serial (used in 90% of cheap Chinese printers)
  '0000ffe1-0000-1000-8000-00805f9b34fb', // Very common alternative for serial communication
  '000018f0-0000-1000-8000-00805f9b34fb', // Generic thermal printer service
  '0000fff0-0000-1000-8000-00805f9b34fb', // Common generic BLE printer service
  '0000ff00-0000-1000-8000-00805f9b34fb', // Custom FF00 service (very common)
  '0000e003-0000-1000-8000-00805f9b34fb', // Custom BLE printer
  '0000ae30-0000-1000-8000-00805f9b34fb', // Jiabo / Chinese thermal printers
  '0000fee7-0000-1000-8000-00805f9b34fb', // Tencent/WeChat Printer service
  '0000ffe5-0000-1000-8000-00805f9b34fb', // CC2540/CC2541 alternative
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC BLE
  '00004953-5343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC BLE Alt
  '00001101-0000-1000-8000-00805f9b34fb'  // Standard Serial Port Profile (SPP)
];

/**
 * Helper to parse and replace modern unsupported color functions like oklch(), color-mix(), color(), etc.
 * with a standard fallback color (rgba) to prevent html2canvas parsing errors.
 */
function replaceColorMixAndOklch(cssText: string): string {
  let result = cssText;
  const targets = ['color-mix', 'light-dark', 'oklch', 'oklab', 'color', 'lab', 'lch', 'hwb'];
  for (const target of targets) {
    const targetLower = (target + '(').toLowerCase();
    let index = 0;
    while ((index = result.toLowerCase().indexOf(targetLower, index)) !== -1) {
      let openCount = 1;
      let j = index + target.length + 1;
      while (j < result.length && openCount > 0) {
        if (result[j] === '(') openCount++;
        else if (result[j] === ')') openCount--;
        j++;
      }
      if (openCount === 0) {
        const fallback = 'rgba(0,0,0,1)';
        result = result.slice(0, index) + fallback + result.slice(j);
      } else {
        index += target.length + 1;
      }
    }
  }
  return result;
}

/**
 * Deeply clean style attributes of elements to strip unsupported CSS functions.
 */
function cleanElementStyles(el: HTMLElement) {
  if (el.style && el.style.cssText) {
    el.style.cssText = replaceColorMixAndOklch(el.style.cssText);
  }
  const children = el.getElementsByTagName('*');
  for (let i = 0; i < children.length; i++) {
    const child = children[i] as HTMLElement;
    if (child.style && child.style.cssText) {
      child.style.cssText = replaceColorMixAndOklch(child.style.cssText);
    }
  }
}

/**
 * Temporarily swap all active stylesheets with versions that don't have modern color functions.
 */
async function withSafeStylesheets<T>(fn: () => Promise<T>): Promise<T> {
  const originalSheets: { sheet: any; disabled: boolean }[] = [];
  const tempStylesheets: HTMLStyleElement[] = [];

  try {
    for (let i = 0; i < document.styleSheets.length; i++) {
      const sheet = document.styleSheets[i] as any;
      try {
        const rules = sheet.cssRules || sheet.rules;
        if (rules) {
          let cssText = '';
          for (let r = 0; r < rules.length; r++) {
            cssText += rules[r].cssText + '\n';
          }
          const cleanCss = replaceColorMixAndOklch(cssText);
          const tempStyle = document.createElement('style');
          tempStyle.textContent = cleanCss;
          document.head.appendChild(tempStyle);
          tempStylesheets.push(tempStyle);

          originalSheets.push({
            sheet,
            disabled: sheet.disabled
          });
          sheet.disabled = true;
        }
      } catch (e) {
        // Cross-origin sheets might throw security errors, so we ignore them safely
        console.warn("Could not read stylesheet rules:", e);
      }
    }
    return await fn();
  } finally {
    for (const temp of tempStylesheets) {
      if (temp.parentNode) {
        temp.parentNode.removeChild(temp);
      }
    }
    for (const orig of originalSheets) {
      orig.sheet.disabled = orig.disabled;
    }
  }
}

/**
 * Detect if a style value contains any modern unsupported CSS color formats.
 */
function isUnsupportedColorValue(val: string): boolean {
  const valLower = val.toLowerCase();
  return valLower.includes('oklch') || 
         valLower.includes('oklab') || 
         valLower.includes('color-mix') || 
         valLower.includes('light-dark') || 
         valLower.includes('hwb') || 
         valLower.includes('var(') || 
         valLower.includes('color(') || 
         valLower.includes('lab(') || 
         valLower.includes('lch(') || 
         valLower.includes('linear-gradient');
}

/**
 * Helper to temporarily patch getComputedStyle to bypass html2canvas unsupported color function errors.
 * Modern browsers using Tailwind v4 or custom themes can return modern color spaces like oklch or color-mix.
 * html2canvas fails with "Attempting to parse an unsupported color function" when encountering these.
 */
async function withSafeComputedStyles<T>(fn: () => Promise<T>): Promise<T> {
  const originalGetComputedStyle = window.getComputedStyle;
  
  window.getComputedStyle = function(el: Element, pseudoElt?: string | null) {
    const style = originalGetComputedStyle(el, pseudoElt);
    return new Proxy(style, {
      get(target, prop) {
        if (prop === 'getPropertyValue') {
          return function(propertyName: string) {
            const val = target.getPropertyValue(propertyName);
            if (typeof val === 'string' && isUnsupportedColorValue(val)) {
              if (propertyName.includes('background')) return '#ffffff';
              if (propertyName.includes('color')) return '#000000';
              if (propertyName.includes('border')) return '#000000';
              return 'transparent';
            }
            return val;
          };
        }
        
        const val = target[prop as any];
        if (typeof val === 'string' && isUnsupportedColorValue(val)) {
          const propStr = String(prop).toLowerCase();
          if (propStr.includes('background')) return '#ffffff';
          if (propStr.includes('color')) return '#000000';
          if (propStr.includes('border')) return '#000000';
          return 'transparent';
        }
        
        if (typeof val === 'function') {
          return (val as any).bind(target);
        }
        return val;
      }
    }) as any;
  };

  try {
    return await fn();
  } finally {
    window.getComputedStyle = originalGetComputedStyle;
  }
}

/**
 * Robust Web Bluetooth printer driver for ESC/POS thermal printers.
 * Renders the given HTML element to a monochrome raster image and streams it
 * directly to the printer using standard ESC/POS commands.
 */
export async function printElementViaBluetooth(
  elementId: string, 
  onStatusChange: (status: string) => void
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error('لم يتم العثور على عنصر الفاتورة لتصويره وطباعته');
  }

  // MUST request device first synchronously under user gesture handler
  const nav = navigator as any;
  if (!nav || !nav.bluetooth) {
    throw new Error('متصفحك أو جهازك الحالي لا يدعم خاصية Web Bluetooth المباشرة. يرجى استخدام متصفح Google Chrome على هاتف أندرويد.');
  }

  onStatusChange('جاري البحث عن طابعة بلوتوث... يرجى اختيار طابعتك من القائمة الحوارية.');

  // 1. Request Bluetooth Device (Directly in the synchronous call tree to maintain user gesture)
  let device: any;
  try {
    device = await nav.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: PRINTER_SERVICE_UUIDS
    });
  } catch (err: any) {
    throw new Error(`تم إلغاء الاتصال بالطابعة أو لم يتم تحديد جهاز: ${err.message || err}`);
  }

  onStatusChange(`تم العثور على: ${device.name || 'طابعة غير معروفة'}. جاري الاتصال...`);

  // 2. Connect to GATT Server
  const server = await device.gatt?.connect();
  if (!server) {
    throw new Error('فشل الاتصال بخدمة الـ GATT بالطابعة');
  }

  onStatusChange('جاري البحث عن خدمات الطباعة والخصائص...');

  // 3. Find the service and write characteristic
  let printerCharacteristic: any = null;
  let services: any[] = [];
  
  onStatusChange('جاري فحص خدمات الطابعة المتاحة بسرعة...');
  try {
    // Try to get all services in a single request. This is extremely fast and standard.
    // Wrap in a short timeout so that if the GATT server hangs here, we can proceed to fallback.
    const getServicesPromise = server.getPrimaryServices();
    const servicesTimeout = new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2500));
    services = await Promise.race([getServicesPromise, servicesTimeout]);
    console.log(`Found ${services?.length || 0} primary services`);
  } catch (allErr) {
    console.warn("Could not retrieve all services in one call, using direct fallback:", allErr);
  }

  if (services && services.length > 0) {
    for (const service of services) {
      try {
        console.log(`Checking service characteristics for: ${service.uuid}`);
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            printerCharacteristic = char;
            console.log(`Found printer write characteristic: ${char.uuid} in service: ${service.uuid}`);
            break;
          }
        }
      } catch (charErr) {
        console.warn(`Could not read characteristics for service ${service.uuid}:`, charErr);
      }
      if (printerCharacteristic) break;
    }
  }

  // Fallback: If getPrimaryServices returned nothing, failed, or timed out, try querying known UUIDs directly.
  // We query them in parallel with a strict 2-second timeout so the system NEVER hangs or queues sequentially.
  if (!printerCharacteristic) {
    onStatusChange('جاري البحث المتوازي في خدمات الطباعة القياسية البديلة...');
    try {
      const servicePromises = PRINTER_SERVICE_UUIDS.map(async (uuid) => {
        try {
          const servicePromise = server.getPrimaryService(uuid);
          const timeoutPromise = new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000));
          const service = await Promise.race([servicePromise, timeoutPromise]) as any;
          if (service) {
            const characteristics = await service.getCharacteristics();
            for (const char of characteristics) {
              if (char.properties.write || char.properties.writeWithoutResponse) {
                return { service, char };
              }
            }
          }
        } catch (e) {
          // Silently ignore failures for individual services in parallel
        }
        return null;
      });

      const results = await Promise.all(servicePromises);
      const validResult = results.find(r => r !== null);
      if (validResult) {
        printerCharacteristic = validResult.char;
        console.log(`Found printer characteristic via parallel fallback in service: ${validResult.service.uuid}`);
      }
    } catch (allParallelErr) {
      console.error("Parallel fallback failed:", allParallelErr);
    }
  }

  if (!printerCharacteristic) {
    throw new Error('لم يتم العثور على خاصية الكتابة (Write Characteristic) لإرسال الأوامر للطابعة');
  }

  onStatusChange('تم الاتصال بنجاح! جاري الآن تصوير وتجهيز الفاتورة للطباعة...');

  // 4. Render the element to a canvas using an isolated off-screen iframe
  // This completely bypasses parent document stylesheet parsing issues in html2canvas (such as oklch or color-mix crashes)
  let canvas: HTMLCanvasElement;
  const printWidth = 576;
  
  // Create off-screen rendering iframe
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '-9999px';
  iframe.style.left = '-9999px';
  iframe.style.width = `${printWidth}px`;
  iframe.style.height = 'auto';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);
  
  const iframeDoc = iframe.contentWindow?.document;
  if (!iframeDoc) {
    iframe.remove();
    throw new Error('فشل تهيئة سياق التصوير الفرعي المخصص للفاتورة');
  }
  
  // Clone the printable invoice element
  const clone = element.cloneNode(true) as HTMLElement;
  
  // Strip any unsupported modern color inline styles
  cleanElementStyles(clone);

  // Add a white spacer at the bottom to prevent any trailing text from getting cut off at the paper cutter
  const spacer = document.createElement('div');
  spacer.className = 'print-spacer';
  spacer.style.height = '50px'; // 50px of empty white space
  clone.appendChild(spacer);
  
  // Write isolated HTML document with safe basic layout CSS
  iframeDoc.open();
  iframeDoc.write(`
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8" />
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap');
          
          body {
            font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
            background: #ffffff !important;
            color: #000000 !important;
            width: ${printWidth}px !important;
            margin: 0 !important;
            padding: 4px !important;
            box-sizing: border-box !important;
            font-size: 42px !important;
            line-height: 1.4 !important;
            -webkit-font-smoothing: none !important;
            -moz-osx-font-smoothing: none !important;
            font-smoothing: none !important;
            text-rendering: geometricPrecision !important;
          }
          
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          th, td {
            padding: 8px 4px !important;
            font-size: 38px !important;
            border-bottom: 1.5px solid #000000 !important;
            line-height: 1.4 !important;
            word-break: keep-all !important;
          }
          td:first-child {
            white-space: nowrap !important;
          }
          th {
            font-weight: 800 !important;
          }
          
          /* Custom bold/stroke contrast settings for thermal print clarity */
          * {
            color: #000000 !important;
            font-weight: 500 !important;
            background-color: transparent !important;
            -webkit-font-smoothing: none !important;
            -moz-osx-font-smoothing: none !important;
            font-smoothing: none !important;
            text-rendering: geometricPrecision !important;
          }
          
          /* Standard structural flex and text styles since Tailwind doesn't load here */
          .flex { display: flex !important; }
          .justify-between { justify-content: space-between !important; }
          .items-center { align-items: center !important; }
          .flex-col { flex-direction: column !important; }
          .text-center { text-align: center !important; }
          .text-right { text-align: right !important; }
          .text-left { text-align: left !important; }
          .font-black { font-weight: 800 !important; }
          .font-bold { font-weight: 700 !important; }
          .text-3xl { font-size: 80px !important; line-height: 1.1 !important; }
          .text-2xl { font-size: 64px !important; line-height: 1.1 !important; }
          .text-xl { font-size: 50px !important; line-height: 1.1 !important; }
          .text-lg { font-size: 44px !important; line-height: 1.2 !important; }
          .text-base { font-size: 36px !important; line-height: 1.2 !important; }
          .text-sm { font-size: 32px !important; line-height: 1.2 !important; }
          .text-xs { font-size: 26px !important; line-height: 1.2 !important; }
          .mb-4 { margin-bottom: 16px !important; }
          .mb-8 { margin-bottom: 28px !important; }
          .mb-10 { margin-bottom: 35px !important; }
          .pb-3 { padding-bottom: 12px !important; }
          .pb-4 { padding-bottom: 16px !important; }
          .pb-6 { padding-bottom: 20px !important; }
          .pt-2 { padding-top: 8px !important; }
          .pt-4 { padding-top: 16px !important; }
          .mt-2 { margin-top: 8px !important; }
          .mt-4 { margin-top: 16px !important; }
          
          /* Border overrides */
          .border-b-3 { border-bottom: 3px solid #000000 !important; }
          .border-t-3 { border-top: 3px solid #000000 !important; }
          .border-b-2 { border-bottom: 2px solid #000000 !important; }
          .border-b { border-bottom: 1.5px solid #000000 !important; }
          .border-t { border-top: 1.5px solid #000000 !important; }
          .border-dashed { border-style: dashed !important; border-width: 2px !important; border-color: #000000 !important; }
          .border-dotted { border-style: dotted !important; border-width: 2px !important; border-color: #000000 !important; }
          
          /* Spacing utilities */
          .space-y-1\\.5 > * + * { margin-top: 6px !important; }
          .space-y-2 > * + * { margin-top: 8px !important; }
          .space-y-3 > * + * { margin-top: 12px !important; }
          
          .w-full { width: 100% !important; }
          .underline { text-decoration: underline !important; }
        </style>
      </head>
      <body>
        <div id="printable-invoice">
          ${clone.innerHTML}
        </div>
      </body>
    </html>
  `);
  iframeDoc.close();
  
  // Wait for resources/fonts to be loaded inside iframe
  await new Promise(resolve => setTimeout(resolve, 200));
  
  try {
    // Generate the canvas from the clean, isolated iframe body
    canvas = await html2canvas(iframeDoc.body, {
      width: printWidth,
      scale: 1,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0
    });
  } catch (err: any) {
    console.error("Iframe html2canvas failed:", err);
    throw new Error(`فشل تصوير الفاتورة للطباعة: ${err.message || err}`);
  } finally {
    // Make sure we clean up and remove the iframe from DOM immediately
    iframe.remove();
  }

  onStatusChange('جاري معالجة الصورة وتحويلها إلى نظام البكسل الأحادي...');

  // Force resizing the canvas to exactly 576px wide (the standard for 80mm/8cm printing)
  let processedCanvas = canvas;
  if (canvas.width !== 576) {
    const resizedCanvas = document.createElement('canvas');
    resizedCanvas.width = 576;
    resizedCanvas.height = Math.round(canvas.height * (576 / canvas.width));
    const rCtx = resizedCanvas.getContext('2d');
    if (rCtx) {
      rCtx.fillStyle = '#ffffff';
      rCtx.fillRect(0, 0, resizedCanvas.width, resizedCanvas.height);
      rCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, resizedCanvas.width, resizedCanvas.height);
      processedCanvas = resizedCanvas;
    }
  }

  const ctx = processedCanvas.getContext('2d');
  if (!ctx) throw new Error('فشل تهيئة سياق الـ Canvas');

  const width = processedCanvas.width;
  const height = processedCanvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // Convert image to monochrome bit matrix
  // 576 pixels width = 72 bytes per row
  const widthBytes = Math.ceil(width / 8);
  const totalBytes = widthBytes * height;
  const dots = new Uint8Array(totalBytes);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const alpha = data[idx + 3];

      // If transparent, count as white. Otherwise calculate luminance (threshold to 150 for higher contrast without blurred numbers)
      const isBlack = alpha < 50 ? false : (0.299 * r + 0.587 * g + 0.114 * b) < 150;

      if (isBlack) {
        const byteIdx = y * widthBytes + Math.floor(x / 8);
        const bitIdx = 7 - (x % 8);
        dots[byteIdx] |= (1 << bitIdx);
      }
    }
  }

  // Generate ESC/POS commands
  // Initialize printer: ESC @ (0x1B, 0x40)
  const initCmd = new Uint8Array([0x1B, 0x40]);

  // Print raster image: GS v 0 m xL xH yL yH d1...dk
  // GS v 0 0: 0x1D, 0x76, 0x30, 0x00
  const xL = widthBytes % 256;
  const xH = Math.floor(widthBytes / 256);
  const yL = height % 256;
  const yH = Math.floor(height / 256);

  const headerCmd = new Uint8Array([
    0x1D, 0x76, 0x30, 0,
    xL, xH,
    yL, yH
  ]);

  // Feed paper & Cut: GS V 66 0 (0x1D, 0x56, 0x42, 0x00) -> 3 lines feed then cut
  const feedAndCutCmd = new Uint8Array([
    0x1B, 0x64, 0x04, // Feed 4 lines (ESC d 4)
    0x1D, 0x56, 0x42, 0x00 // Partial cut (GS V 66 0)
  ]);

  // Combine commands into a single buffer
  const printBuffer = new Uint8Array(initCmd.length + headerCmd.length + dots.length + feedAndCutCmd.length);
  printBuffer.set(initCmd, 0);
  printBuffer.set(headerCmd, initCmd.length);
  printBuffer.set(dots, initCmd.length + headerCmd.length);
  printBuffer.set(feedAndCutCmd, initCmd.length + headerCmd.length + dots.length);

  onStatusChange('جاري إرسال بيانات الفاتورة للطابعة...');

  // 5. Send data in chunks (essential to prevent packet drops in thermal printers)
  const chunkSize = 200; // Safe chunk size for BLE
  for (let i = 0; i < printBuffer.length; i += chunkSize) {
    const chunk = printBuffer.slice(i, i + chunkSize);
    
    if (printerCharacteristic.properties.writeWithoutResponse) {
      await printerCharacteristic.writeValueWithoutResponse(chunk);
    } else {
      await printerCharacteristic.writeValue(chunk);
    }

    // Small delay to let the printer buffer process
    await new Promise(resolve => setTimeout(resolve, 20));
    
    const progress = Math.round((i / printBuffer.length) * 100);
    onStatusChange(`جاري الطباعة: تم إرسال ${progress}% من البيانات...`);
  }

  // Disconnect
  device.gatt?.disconnect();
  onStatusChange('تمت عملية الطباعة المباشرة بنجاح وتم قطع الاتصال.');
}

/**
 * Print the given HTML element using RawBT Android App via intent:// scheme.
 * Generates monochrome ESC/POS graphic raster commands for maximum clarity
 * and encodes them to base64, then fires the RawBT printing intent.
 */
export async function printElementViaRawBT(
  elementOrId: string | HTMLElement,
  onStatusChange: (status: string) => void = () => {}
): Promise<void> {
  const element = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
  if (!element) {
    throw new Error('لم يتم العثور على عنصر الفاتورة لتصويره وطباعته');
  }

  onStatusChange('جاري تهيئة وتصوير الفاتورة للطباعة عبر تطبيق RawBT...');

  // Render the element to a canvas using the off-screen iframe (isolated styles)
  const printWidth = 576;
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '-9999px';
  iframe.style.left = '-9999px';
  iframe.style.width = `${printWidth}px`;
  iframe.style.height = 'auto';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document;
  if (!iframeDoc) {
    iframe.remove();
    throw new Error('فشل تهيئة سياق التصوير الفرعي المخصص للفاتورة');
  }

  const clone = element.cloneNode(true) as HTMLElement;
  cleanElementStyles(clone);

  // Add a white spacer at the bottom to prevent any trailing text from getting cut off at the paper cutter
  const spacer = document.createElement('div');
  spacer.className = 'print-spacer';
  spacer.style.height = '50px'; // 50px of empty white space
  clone.appendChild(spacer);

  iframeDoc.open();
  iframeDoc.write(`
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8" />
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap');
          
          body {
            font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
            background: #ffffff !important;
            color: #000000 !important;
            width: ${printWidth}px !important;
            margin: 0 !important;
            padding: 4px !important;
            box-sizing: border-box !important;
            font-size: 42px !important;
            line-height: 1.4 !important;
            -webkit-font-smoothing: none !important;
            -moz-osx-font-smoothing: none !important;
            font-smoothing: none !important;
            text-rendering: geometricPrecision !important;
          }
          
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          th, td {
            padding: 8px 4px !important;
            font-size: 38px !important;
            border-bottom: 1.5px solid #000000 !important;
            line-height: 1.4 !important;
            word-break: keep-all !important;
          }
          td:first-child {
            white-space: nowrap !important;
          }
          th {
            font-weight: 800 !important;
          }
          
          * {
            color: #000000 !important;
            font-weight: 500 !important;
            background-color: transparent !important;
            -webkit-font-smoothing: none !important;
            -moz-osx-font-smoothing: none !important;
            font-smoothing: none !important;
            text-rendering: geometricPrecision !important;
          }
          
          .flex { display: flex !important; }
          .justify-between { justify-content: space-between !important; }
          .items-center { align-items: center !important; }
          .flex-col { flex-direction: column !important; }
          .text-center { text-align: center !important; }
          .text-right { text-align: right !important; }
          .text-left { text-align: left !important; }
          .font-black { font-weight: 800 !important; }
          .font-bold { font-weight: 700 !important; }
          .text-2xl { font-size: 64px !important; line-height: 1.1 !important; }
          .text-3xl { font-size: 80px !important; line-height: 1.1 !important; }
          .text-lg { font-size: 44px !important; line-height: 1.2 !important; }
          .text-base { font-size: 36px !important; line-height: 1.2 !important; }
          .text-sm { font-size: 32px !important; line-height: 1.2 !important; }
          .text-xs { font-size: 26px !important; line-height: 1.2 !important; }
          .mb-4 { margin-bottom: 16px !important; }
          .mb-8 { margin-bottom: 28px !important; }
          .mb-10 { margin-bottom: 35px !important; }
          .pb-3 { padding-bottom: 12px !important; }
          .pb-4 { padding-bottom: 16px !important; }
          .pb-6 { padding-bottom: 20px !important; }
          .pt-2 { padding-top: 8px !important; }
          .pt-4 { padding-top: 16px !important; }
          .mt-2 { margin-top: 8px !important; }
          .mt-4 { margin-top: 16px !important; }
          
          .border-b-3 { border-bottom: 3px solid #000000 !important; }
          .border-t-3 { border-top: 3px solid #000000 !important; }
          .border-b-2 { border-bottom: 2px solid #000000 !important; }
          .border-b { border-bottom: 1.5px solid #000000 !important; }
          .border-t { border-top: 1.5px solid #000000 !important; }
          .border-dashed { border-style: dashed !important; border-width: 2px !important; border-color: #000000 !important; }
          .border-dotted { border-style: dotted !important; border-width: 2px !important; border-color: #000000 !important; }
          
          .space-y-1\\.5 > * + * { margin-top: 6px !important; }
          .space-y-2 > * + * { margin-top: 8px !important; }
          .space-y-3 > * + * { margin-top: 12px !important; }
          
          .w-full { width: 100% !important; }
          .underline { text-decoration: underline !important; }
        </style>
      </head>
      <body>
        <div id="printable-invoice">
          ${clone.innerHTML}
        </div>
      </body>
    </html>
  `);
  iframeDoc.close();

  // Wait briefly for resources to load in the iframe
  await new Promise(resolve => setTimeout(resolve, 300));

  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(iframeDoc.body, {
      width: printWidth,
      scale: 1, // 1:1 pixel grid for absolute crisp typography and graphics without downscaling interpolation
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0
    });
  } catch (err: any) {
    console.error("Iframe html2canvas failed:", err);
    throw new Error(`فشل تصوير الفاتورة للطباعة: ${err.message || err}`);
  } finally {
    iframe.remove();
  }

  onStatusChange('جاري معالجة الصورة وتحويلها لنظام البكسل الأحادي...');

  // Resize canvas to exactly 576px wide (standard for thermal printers)
  let processedCanvas = canvas;
  if (canvas.width !== 576) {
    const resizedCanvas = document.createElement('canvas');
    resizedCanvas.width = 576;
    resizedCanvas.height = Math.round(canvas.height * (576 / canvas.width));
    const rCtx = resizedCanvas.getContext('2d');
    if (rCtx) {
      rCtx.fillStyle = '#ffffff';
      rCtx.fillRect(0, 0, resizedCanvas.width, resizedCanvas.height);
      rCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, resizedCanvas.width, resizedCanvas.height);
      processedCanvas = resizedCanvas;
    }
  }

  const ctx = processedCanvas.getContext('2d');
  if (!ctx) throw new Error('فشل تهيئة سياق الـ Canvas');

  const width = processedCanvas.width;
  const height = processedCanvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const widthBytes = Math.ceil(width / 8);
  const totalBytes = widthBytes * height;
  const dots = new Uint8Array(totalBytes);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const alpha = data[idx + 3];

      // Luminance thresholding (threshold to 150 for higher contrast without blurred numbers)
      const isBlack = alpha < 50 ? false : (0.299 * r + 0.587 * g + 0.114 * b) < 150;

      if (isBlack) {
        const byteIdx = y * widthBytes + Math.floor(x / 8);
        const bitIdx = 7 - (x % 8);
        dots[byteIdx] |= (1 << bitIdx);
      }
    }
  }

  // Generate ESC/POS commands
  const initCmd = new Uint8Array([0x1B, 0x40]);
  const xL = widthBytes % 256;
  const xH = Math.floor(widthBytes / 256);
  const yL = height % 256;
  const yH = Math.floor(height / 256);

  const headerCmd = new Uint8Array([
    0x1D, 0x76, 0x30, 0,
    xL, xH,
    yL, yH
  ]);

  const feedAndCutCmd = new Uint8Array([
    0x1B, 0x64, 0x04, // Feed 4 lines (ESC d 4)
    0x1D, 0x56, 0x42, 0x00 // Partial cut
  ]);

  const printBuffer = new Uint8Array(initCmd.length + headerCmd.length + dots.length + feedAndCutCmd.length);
  printBuffer.set(initCmd, 0);
  printBuffer.set(headerCmd, initCmd.length);
  printBuffer.set(dots, initCmd.length + headerCmd.length);
  printBuffer.set(feedAndCutCmd, initCmd.length + headerCmd.length + dots.length);

  onStatusChange('جاري إرسال الفاتورة لتطبيق RawBT...');

  // Convert binary print buffer to base64
  let binary = '';
  const len = printBuffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(printBuffer[i]);
  }
  const base64 = window.btoa(binary);

  // Construct the RawBT intent URL
  const intentUri = `intent:base64,${base64}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;

  // Navigate to RawBT app intent
  window.location.href = intentUri;

  onStatusChange('تم إرسال الفاتورة بنجاح لتطبيق RawBT للطباعة 🚀');
}

/**
 * Directly prints structured invoice data via RawBT Android App.
 * Creates a dedicated thermal element matching the official receipt layout,
 * renders it, and fires the RawBT printing intent.
 */
export async function printInvoiceDataViaRawBT(
  invoice: any,
  customer?: any,
  settings?: any,
  onStatusChange: (status: string) => void = () => {}
): Promise<void> {
  if (typeof document === 'undefined') return;

  // Cleanup any old temporary print container
  const oldContainer = document.getElementById('rawbt-auto-print-container');
  if (oldContainer) oldContainer.remove();

  const container = document.createElement('div');
  container.id = 'rawbt-auto-print-container';
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '576px';
  container.style.background = '#ffffff';
  container.style.zIndex = '-1000';
  container.dir = 'rtl';

  const companyPhone = settings?.companyPhone || '';
  const customerPhone = customer?.phone || '';
  const invoiceId = String(invoice.id || '').slice(-8).toUpperCase();
  const customerName = invoice.customerName || customer?.shopName || 'عميل بدون اسم';
  const representativeName = invoice.representativeName || '';
  const date = invoice.date || '';
  const time = invoice.time || '';

  const activeItems = (invoice.items || []).filter((it: any) => (it.sold || 0) > 0 || (it.returnDamaged || 0) > 0 || (it.gifts || 0) > 0);
  const hasDamaged = activeItems.some((x: any) => (x.returnDamaged || 0) > 0);
  const hasGifts = activeItems.some((x: any) => (x.gifts || 0) > 0);
  const damagedTotal = activeItems.reduce((acc: number, it: any) => acc + ((it.returnDamaged || 0) * (it.price || 0)), 0);
  const giftsTotal = activeItems.reduce((acc: number, it: any) => acc + ((it.gifts || 0) * (it.price || 0)), 0);
  const balanceAfter = invoice.customerBalanceAfter !== undefined 
    ? invoice.customerBalanceAfter 
    : (customer ? customer.openingBalance : 0);

  const itemsHtml = activeItems.map((item: any) => `
    <tr class="border-b border-solid border-black/20">
      <td class="py-2 text-xs font-black text-black whitespace-nowrap">${item.productName}</td>
      <td class="py-2 text-center text-xs font-black text-black">${item.price}</td>
      <td class="py-2 text-center text-xs font-black text-black">${item.sold || 0}</td>
      ${hasDamaged ? `<td class="py-2 text-center text-xs font-black text-black">${item.returnDamaged || 0}</td>` : ''}
      ${hasGifts ? `<td class="py-2 text-center text-xs font-black text-black">${item.gifts || 0}</td>` : ''}
      <td class="py-2 text-left text-xs font-black text-black">${(item.total || 0).toLocaleString()}</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <div class="p-4 bg-white w-full max-w-[576px] mx-auto text-black font-mono text-sm border-3 border-black leading-relaxed">
      <div class="text-center mb-4 border-b-3 border-black pb-3">
        <h2 class="text-2xl font-serif font-black text-black">شركة OK</h2>
        <p class="text-xs text-black font-black mt-1">نظام الإدارة المتكامل</p>
        ${companyPhone ? `<p class="text-xs text-black font-black mt-1">تليفون الشركة: ${companyPhone}</p>` : ''}
      </div>

      <div class="flex justify-between items-center mb-4 text-xs border-b-3 border-black pb-3">
        <span class="font-black text-black">فاتورة مبيعات</span>
        <span class="font-black">ID: ${invoiceId}</span>
      </div>

      <div class="space-y-1.5 text-xs mb-4 border-b-3 border-black pb-3">
        <div class="flex justify-between">
          <span class="text-black font-black">العميل:</span>
          <span class="font-black text-black">${customerName}</span>
        </div>
        ${customerPhone ? `
        <div class="flex justify-between">
          <span class="text-black font-black">تليفون العميل:</span>
          <span class="font-black text-black">${customerPhone}</span>
        </div>` : ''}
        <div class="flex justify-between">
          <span class="text-black font-black">المندوب:</span>
          <span class="font-black text-black">${representativeName}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-black font-black">التاريخ:</span>
          <span class="font-black text-black">${date} | ${time}</span>
        </div>
      </div>

      <div class="mb-4 border-b-3 border-black pb-3">
        <table class="w-full text-right border-collapse">
          <thead>
            <tr class="border-b-3 border-black">
              <th class="py-2 font-black text-xs text-black uppercase">المنتج</th>
              <th class="py-2 text-center font-black text-xs text-black uppercase">السعر</th>
              <th class="py-2 text-center font-black text-xs text-black uppercase">عدد</th>
              ${hasDamaged ? `<th class="py-2 text-center font-black text-xs text-black uppercase">تالف</th>` : ''}
              ${hasGifts ? `<th class="py-2 text-center font-black text-xs text-black uppercase">هدايا</th>` : ''}
              <th class="py-2 text-left font-black text-xs text-black uppercase">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
      </div>

      <div class="flex justify-end">
        <div class="w-full space-y-1.5 text-black text-xs font-black">
          <div class="flex justify-between">
            <span class="text-black font-black">المجموع الفرعي</span>
            <span class="font-black">${(invoice.subtotal || 0).toLocaleString()} ج.م</span>
          </div>
          ${hasDamaged ? `
          <div class="flex justify-between">
            <span class="text-black font-black">قيمة المرتجع</span>
            <span class="font-black text-black border-b border-black">-${damagedTotal.toLocaleString()} ج.م</span>
          </div>` : ''}
          ${hasGifts ? `
          <div class="flex justify-between">
            <span class="text-black font-black">قيمة الهدايا</span>
            <span class="font-black text-black">+${giftsTotal.toLocaleString()} ج.م</span>
          </div>` : ''}
          ${(invoice.discountValue || 0) > 0 ? `
          <div class="flex justify-between">
            <span class="text-black font-black">الخصم</span>
            <span class="font-black text-black">-${invoice.discountValue} ${invoice.discountType === 'percentage' ? '%' : 'ج.م'}</span>
          </div>` : ''}
          ${(invoice.credit || 0) > 0 ? `
          <div class="flex justify-between">
            <span class="text-black font-black">آجل (مديونية)</span>
            <span class="font-black text-black">-${(invoice.credit || 0).toLocaleString()} ج.م</span>
          </div>` : ''}
          ${(invoice.collection || 0) > 0 ? `
          <div class="flex justify-between">
            <span class="text-black font-black">تحصيل (سداد قديم)</span>
            <span class="font-black text-black">+${(invoice.collection || 0).toLocaleString()} ج.م</span>
          </div>` : ''}
          ${(invoice.walletAmount || 0) > 0 ? `
          <div class="flex justify-between border-t-2 border-black pt-1.5">
            <span class="text-black font-black">تحويل محفظة</span>
            <span class="font-black text-black">${(invoice.walletAmount || 0).toLocaleString()} ج.م</span>
          </div>` : ''}
          
          <div class="pt-2 mt-2 border-t-3 border-black space-y-2 text-black">
            <div class="flex justify-between items-center text-sm">
              <span class="font-black">الرصيد النهائي للعميل</span>
              <span class="text-base font-black underline decoration-2 underline-offset-4">${(balanceAfter || 0).toLocaleString()} ج.م</span>
            </div>
            <div class="flex justify-between items-center text-sm">
              <span class="font-black">المحصل اليوم</span>
              <span class="text-base font-black underline decoration-2 underline-offset-4">${(invoice.totalPaidToday || 0).toLocaleString()} ج.م</span>
            </div>
          </div>
        </div>
      </div>
      <div class="text-center mt-4 pt-2 border-t border-dashed border-black text-xs font-black">
        شكراً لتعاملكم معنا
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    await printElementViaRawBT(container, onStatusChange);
  } finally {
    setTimeout(() => {
      container.remove();
    }, 2500);
  }
}
