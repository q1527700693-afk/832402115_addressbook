import ExcelJS from 'exceljs';
import { ValidationError } from './store.js';

export const HEADERS = [
  '姓名',
  '公司',
  '职位',
  '生日',
  '标签',
  '收藏',
  '手机1',
  '手机2',
  '手机3',
  '邮箱1',
  '邮箱2',
  '微信',
  'QQ',
  '地址',
  '其他',
  '备注',
];

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5D50' } };
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Microsoft YaHei' };
const BODY_FONT = { size: 10.5, name: 'Microsoft YaHei', color: { argb: 'FF26231E' } };
const BORDER = {
  top: { style: 'thin', color: { argb: 'FFE4DED2' } },
  left: { style: 'thin', color: { argb: 'FFE4DED2' } },
  bottom: { style: 'thin', color: { argb: 'FFE4DED2' } },
  right: { style: 'thin', color: { argb: 'FFE4DED2' } },
};

const METHOD_LABELS = {
  phone: '手机',
  email: '邮箱',
  wechat: '微信',
  qq: 'QQ',
  address: '地址',
  other: '其他',
};

function joinValues(methods, type, separator = ' / ') {
  return methods.filter((method) => method.type === type).map((method) => method.value).join(separator);
}

function overflow(values, columns) {
  if (values.length <= columns) return values;
  const head = values.slice(0, columns - 1);
  head.push(values.slice(columns - 1).join(' / '));
  return head;
}

export function contactToRow(contact) {
  const methods = contact.methods ?? [];
  const phones = overflow(methods.filter((m) => m.type === 'phone').map((m) => m.value), 3);
  const emails = overflow(methods.filter((m) => m.type === 'email').map((m) => m.value), 2);
  return [
    contact.name,
    contact.company,
    contact.title,
    contact.birthday,
    contact.tags.join('、'),
    contact.isFavorite ? '是' : '否',
    phones[0] ?? '',
    phones[1] ?? '',
    phones[2] ?? '',
    emails[0] ?? '',
    emails[1] ?? '',
    joinValues(methods, 'wechat'),
    joinValues(methods, 'qq'),
    joinValues(methods, 'address', '；'),
    joinValues(methods, 'other', '；'),
    contact.note,
  ];
}

const COLUMN_WIDTHS = [12, 16, 14, 11, 15, 7, 15, 15, 15, 24, 24, 15, 13, 30, 18, 42];

function displayLength(value) {
  return [...String(value ?? '')].reduce(
    (total, char) => total + (/[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/.test(char) ? 2 : 1),
    0,
  );
}

function wrappedLines(value, width) {
  return Math.max(1, Math.ceil(displayLength(value) / Math.max(4, width - 2)));
}

function styleSheet(sheet, rowCount) {
  sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: HEADERS.length } };
  sheet.pageSetup = { fitToPage: true, fitToWidth: 2, fitToHeight: 0, orientation: 'landscape', paperSize: 9 };
  sheet.getRow(1).height = 26;
  sheet.getRow(1).eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = BORDER;
  });
  sheet.columns = COLUMN_WIDTHS.map((width) => ({ width }));
  for (let rowNumber = 2; rowNumber <= rowCount + 1; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const lines = Math.max(
      wrappedLines(row.getCell(16).value, COLUMN_WIDTHS[15]),
      wrappedLines(row.getCell(14).value, COLUMN_WIDTHS[13]),
      wrappedLines(row.getCell(15).value, COLUMN_WIDTHS[14]),
    );
    row.height = Math.min(110, Math.max(22, lines * 14 + 8));
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      cell.font = BODY_FONT;
      cell.border = BORDER;
      cell.alignment = {
        vertical: 'middle',
        horizontal: columnNumber === 6 ? 'center' : 'left',
        wrapText: [14, 15, 16].includes(columnNumber),
      };
      if (rowNumber % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F6EF' } };
      }
    });
  }
  sheet.getColumn(6).numFmt = '@';
}

export async function buildContactsWorkbook(contacts) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Shiguang Address Book';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('通讯录', {
    properties: { defaultRowHeight: 21 },
    pageSetup: { fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: 'landscape' },
  });
  sheet.addRow(HEADERS);
  contacts.forEach((contact) => sheet.addRow(contactToRow(contact)));
  styleSheet(sheet, contacts.length);
  return workbook.xlsx.writeBuffer();
}

export async function buildTemplateWorkbook() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('通讯录');
  sheet.addRow(HEADERS);
  sheet.addRow([
    '林知夏', '云栖设计', '产品设计师', '1996-04-12', '设计、朋友', '是',
    '13800001234', '0571-88886666', '', 'zhixia.lin@example.com', '',
    'zhixia_design', '10240001', '杭州市西湖区文三路 90 号', '', '示例行，导入前请删除',
  ]);
  sheet.addRow([
    '陈默', '星环科技', '前端工程师', '1998-09-03', '同事', '否',
    '13900002345', '', '', 'chen.mo@example.com', '', 'chenmo_dev', '', '', '', '支持多行导入',
  ]);
  styleSheet(sheet, 2);
  return workbook.xlsx.writeBuffer();
}

function cellText(cell) {
  const value = cell?.value;
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text).join('');
    if (value.text != null) return String(value.text);
    if (value.result != null) return String(value.result);
    if (value.hyperlink) return String(value.hyperlink);
    return '';
  }
  return String(value).trim();
}

function normalizeHeader(value) {
  return value.replace(/\s+/g, '').toLowerCase();
}

const CORE_ALIASES = new Map([
  ['姓名', 'name'], ['名字', 'name'], ['name', 'name'], ['fullname', 'name'],
  ['公司', 'company'], ['单位', 'company'], ['company', 'company'],
  ['职位', 'title'], ['职务', 'title'], ['title', 'title'], ['position', 'title'],
  ['生日', 'birthday'], ['出生日期', 'birthday'], ['birthday', 'birthday'], ['birth', 'birthday'],
  ['标签', 'tags'], ['tags', 'tags'], ['tag', 'tags'],
  ['收藏', 'favorite'], ['是否收藏', 'favorite'], ['favorite', 'favorite'], ['bookmark', 'favorite'],
  ['备注', 'note'], ['note', 'note'], ['notes', 'note'],
]);

function headerKind(header) {
  const key = normalizeHeader(header);
  if (!key) return null;
  if (key === '手机' || key === '电话' || key === 'phone' || key === 'tel' || key === 'mobile') {
    return { type: 'phone', label: METHOD_LABELS.phone };
  }
  if (/^手机\d+$/.test(key)) return { type: 'phone', label: key.replace('手机', '手机 ') };
  if (/^phone\d+$/.test(key)) return { type: 'phone', label: `手机 ${key.replace('phone', '')}` };
  if (key === '邮箱' || key === 'email' || key === 'e-mail' || key === 'mail') {
    return { type: 'email', label: METHOD_LABELS.email };
  }
  if (/^邮箱\d+$/.test(key)) return { type: 'email', label: key.replace('邮箱', '邮箱 ') };
  if (/^email\d+$/.test(key)) return { type: 'email', label: `邮箱 ${key.replace('email', '')}` };
  if (key === '微信' || key === 'wechat' || key === 'weixin') return { type: 'wechat', label: METHOD_LABELS.wechat };
  if (key === 'qq') return { type: 'qq', label: METHOD_LABELS.qq };
  if (key === '地址' || key === '住址' || key === 'address') return { type: 'address', label: METHOD_LABELS.address };
  if (key === '其他' || key === '其它' || key === 'other') return { type: 'other', label: METHOD_LABELS.other };
  const core = CORE_ALIASES.get(key);
  if (core) return { core };
  return null;
}

const MULTI_VALUE_SPLIT = /\s*\/\s*|[;；\n]+/;

function splitValues(value, { multi = true } = {}) {
  if (!multi) return value ? [value.trim()] : [];
  return String(value)
    .split(MULTI_VALUE_SPLIT)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeBirthdayValue(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const date = new Date(raw);
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(raw) && !Number.isNaN(date.getTime())) {
    const [year, month, day] = raw.split(/[-/]/);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return raw;
}

const TRUTHY = new Set(['是', 'yes', 'y', 'true', '1', '√', '收藏']);

/**
 * Parse an Excel buffer into normalized contact payloads.
 * Throws ValidationError when the sheet itself cannot be imported.
 */
export async function parseContactsWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new ValidationError('无法读取该文件，请确认它是 .xlsx 格式的 Excel 文件');
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new ValidationError('Excel 文件中没有工作表');

  const headerRow = sheet.getRow(1);
  const columns = [];
  let nameColumn = null;
  const usedMethods = new Set();
  for (let column = 1; column <= headerRow.cellCount; column += 1) {
    const header = cellText(headerRow.getCell(column)).trim();
    const kind = headerKind(header);
    if (!kind) continue;
    if (kind.core === 'name') {
      nameColumn = column;
      columns.push({ column, core: 'name' });
    } else if (kind.type && !usedMethods.has(`${kind.type}:${column}`)) {
      usedMethods.add(`${kind.type}:${column}`);
      columns.push({ column, methodType: kind.type, label: kind.label });
    } else if (kind.core) {
      columns.push({ column, core: kind.core });
    }
  }
  if (!nameColumn) {
    throw new ValidationError('缺少「姓名」列，请使用导入模板中的表头');
  }
  if (columns.length === 0) {
    throw new ValidationError('没有识别到有效的数据列，请检查表头');
  }

  const rows = [];
  const lastRow = Math.min(sheet.actualRowCount || sheet.rowCount, 2002);
  for (let rowNumber = 2; rowNumber <= lastRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const data = { methods: [] };
    let hasContent = false;
    for (const { column, core, methodType, label } of columns) {
      const raw = cellText(row.getCell(column));
      if (raw) hasContent = true;
      if (core === 'tags') {
        data.tags = raw;
      } else if (core === 'favorite') {
        data.isFavorite = TRUTHY.has(raw.toLowerCase());
      } else if (core === 'birthday') {
        data.birthday = normalizeBirthdayValue(raw);
      } else if (core) {
        data[core] = raw;
      } else if (methodType && raw) {
        for (const value of splitValues(raw, { multi: methodType === 'phone' || methodType === 'email' })) {
          data.methods.push({ type: methodType, label, value });
        }
      }
    }
    if (!hasContent) continue;
    rows.push({ rowNumber, data });
    if (rows.length > 2000) {
      throw new ValidationError('单次最多导入 2000 位联系人，请拆分文件');
    }
  }
  if (rows.length === 0) {
    throw new ValidationError('表格中没有可导入的数据行');
  }
  return rows;
}
