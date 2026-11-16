import { createDatabase, resolveDbPath } from './db.js';
import { countStats, createContact } from './store.js';

const CONTACTS = [
  {
    name: '罗峰',
    company: '极限武馆',
    title: '战神',
    birthday: '1995-08-15',
    tags: ['战神', '兄弟'],
    note: '江南基地市扬州城出身，从极限武馆学员一路走到战神。训练计划排得很满，约战提前三天。',
    isFavorite: true,
    methods: [
      { type: 'phone', label: '手机', value: '138 0000 1301' },
      { type: 'phone', label: '武馆', value: '0514-8888 1301' },
      { type: 'email', label: '邮箱', value: 'luofeng@example.com' },
      { type: 'wechat', label: '微信', value: 'luofeng_jx' },
      { type: 'address', label: '住址', value: '江南基地市扬州城明月小区 8 栋' },
    ],
  },
  {
    name: '徐欣',
    company: '虚拟网络公司',
    title: '设计师',
    birthday: '1996-11-02',
    tags: ['家人', '虚拟网络'],
    note: '罗峰的妻子，虚拟网络公司设计师。家庭日程和纪念日都记在这里。',
    isFavorite: true,
    methods: [
      { type: 'phone', label: '手机', value: '138 0000 1303' },
      { type: 'email', label: '邮箱', value: 'xuxin@example.com' },
      { type: 'wechat', label: '微信', value: 'xuxin_design' },
      { type: 'address', label: '公司', value: '江南基地市虚拟网络公司总部' },
    ],
  },
  {
    name: '雷神',
    company: '雷电武馆',
    title: '馆主',
    birthday: '1988-03-21',
    tags: ['战神', '兄弟'],
    note: '雷电武馆馆主，和洪以兄弟相称。切磋前记得先确认场地和保险。',
    isFavorite: true,
    methods: [
      { type: 'phone', label: '手机', value: '138 0000 1304' },
      { type: 'email', label: '邮箱', value: 'leishen@example.com' },
      { type: 'wechat', label: '微信', value: 'leishen_wg' },
      { type: 'qq', label: 'QQ', value: '100002' },
      { type: 'address', label: '武馆', value: '雷电武馆总部' },
    ],
  },
  {
    name: '洪',
    company: '极限武馆',
    title: '馆主',
    birthday: '1985-01-09',
    tags: ['战神', '师长'],
    note: '极限武馆馆主，地球第一强者。话不多，但答应的事一定做到。',
    isFavorite: false,
    methods: [
      { type: 'phone', label: '手机', value: '138 0000 1305' },
      { type: 'email', label: '邮箱', value: 'hong@example.com' },
      { type: 'wechat', label: '微信', value: 'hong_jxwg' },
      { type: 'address', label: '武馆', value: '极限武馆总部' },
    ],
  },
  {
    name: '巴巴塔',
    company: '陨墨星号',
    title: '舰载智能',
    tags: ['智能生命', '陨墨星'],
    note: '陨墨星号舰载智能，呼延博留下的智能生命。嘴硬心软，最爱吐槽罗峰。',
    isFavorite: true,
    methods: [
      { type: 'email', label: '邮箱', value: 'babata@example.com' },
      { type: 'wechat', label: '微信', value: 'babata_ai' },
      { type: 'qq', label: 'QQ', value: '100003' },
      { type: 'address', label: '位置', value: '陨墨星号飞船控制室' },
    ],
  },
  {
    name: '魏文',
    company: '火锤小队',
    title: '队员',
    birthday: '1995-04-18',
    tags: ['兄弟', '火锤小队'],
    note: '火锤小队老队员，罗峰的老搭档。出野外任务前记得核对装备清单。',
    isFavorite: false,
    methods: [
      { type: 'phone', label: '手机', value: '138 0000 1306' },
      { type: 'email', label: '邮箱', value: 'weiwen@example.com' },
      { type: 'wechat', label: '微信', value: 'weiwen_fire' },
      { type: 'qq', label: 'QQ', value: '100004' },
    ],
  },
  {
    name: '张科',
    company: '极限武馆',
    title: '学员',
    birthday: '1995-09-30',
    tags: ['同学', '火锤小队'],
    note: '罗峰的高中同学，后来一起加入极限武馆。聚餐永远第一个到。',
    isFavorite: false,
    methods: [
      { type: 'phone', label: '手机', value: '138 0000 1307' },
      { type: 'email', label: '邮箱', value: 'zhangke@example.com' },
      { type: 'wechat', label: '微信', value: 'zhangke_jx' },
      { type: 'qq', label: 'QQ', value: '100005' },
    ],
  },
  {
    name: '江芳',
    company: '江南基地市第一中学',
    title: '教师',
    birthday: '1980-05-12',
    tags: ['老师'],
    note: '罗峰的高中老师，一直关心他的学业。教师节记得发消息。',
    isFavorite: false,
    methods: [
      { type: 'phone', label: '手机', value: '138 0000 1308' },
      { type: 'email', label: '邮箱', value: 'jiangfang@example.com' },
      { type: 'wechat', label: '微信', value: 'jiangfang_teacher' },
      { type: 'address', label: '学校', value: '江南基地市第一中学' },
    ],
  },
  {
    name: '赵若',
    company: '战神宫',
    title: '战神',
    birthday: '1997-02-07',
    tags: ['战神', '师姐'],
    note: '极限武馆的天才学员，后来成为战神。训练强度比罗峰还狠。',
    isFavorite: false,
    methods: [
      { type: 'phone', label: '手机', value: '138 0000 1309' },
      { type: 'email', label: '邮箱', value: 'zhaoruo@example.com' },
      { type: 'wechat', label: '微信', value: 'zhaoruo_jx' },
      { type: 'address', label: '驻地', value: '战神宫总部' },
    ],
  },
  {
    name: '珍妮特',
    company: '战神宫',
    title: '联络官',
    birthday: '1994-12-25',
    tags: ['战神宫', '联络'],
    note: '战神宫联络官，负责任务和资源对接。邮件回复很快。',
    isFavorite: false,
    methods: [
      { type: 'phone', label: '手机', value: '138 0000 1310' },
      { type: 'email', label: '邮箱', value: 'janet@example.com' },
      { type: 'wechat', label: '微信', value: 'janet_wg' },
      { type: 'address', label: '办公', value: '战神宫总部' },
    ],
  },
  {
    name: '李耀',
    company: '李氏集团',
    title: '董事长',
    birthday: '1970-06-16',
    tags: ['合作方'],
    note: '李家家主，表面客气，谈合作时要多留个心眼。',
    isFavorite: false,
    methods: [
      { type: 'phone', label: '手机', value: '138 0000 1311' },
      { type: 'email', label: '邮箱', value: 'liyao@example.com' },
      { type: 'wechat', label: '微信', value: 'liyao_group' },
      { type: 'address', label: '公司', value: '江南基地市李氏大厦' },
    ],
  },
  {
    name: '高升',
    company: '极限武馆',
    title: '高级学员',
    birthday: '1993-07-08',
    tags: ['师兄', '极限武馆'],
    note: '极限武馆高级学员，罗峰的师兄。喜欢收集兵器，聊天三句不离刀。',
    isFavorite: false,
    methods: [
      { type: 'phone', label: '手机', value: '138 0000 1312' },
      { type: 'email', label: '邮箱', value: 'gaosheng@example.com' },
      { type: 'wechat', label: '微信', value: 'gaosheng_jx' },
      { type: 'qq', label: 'QQ', value: '100006' },
    ],
  },
];

const dbPath = resolveDbPath();
const db = createDatabase(dbPath);
db.exec('DELETE FROM contacts WHERE user_id IS NULL;');
db.exec("DELETE FROM sqlite_sequence WHERE name IN ('contacts', 'contact_methods');");

const createdAt = new Date();
CONTACTS.forEach((contact, index) => {
  const created = createContact(db, null, contact);
  const stamp = new Date(createdAt.getTime() - index * 36 * 60 * 60 * 1000).toISOString();
  db.prepare('UPDATE contacts SET created_at = ?, updated_at = ? WHERE id = ?')
    .run(stamp, stamp, created.id);
});

const stats = countStats(db, null);
console.log(`Seeded ${stats.total} contacts (${stats.favorites} favorites) into ${dbPath}`);
db.close();
