const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, "./.env") });

const setting = {
  loyola_id: process.env.LOYOLA_ID,
  loyola_password: process.env.LOYOLA_PASSWORD,
  loyola_uri: "https://scs.cl.sophia.ac.jp/campusweb/campusportal.do",
};

const loyola_xpath = {
  login_username: '//input[@name="userName"]',
  login_password: '//input[@name="password"]',
  login_button: '//input[@value="ログイン"]',
  button_of_curriculum_menu: '//*[@id="tab-rs"]', //ホーム画面ヘッダーのカリキュラム/履修登録メニューのアイコン
  schedule_in_header: '//*[@id="tabmenu-li2"]/span', //カリキュラム/履修登録メニュー内の時間割へのリンク
  link_to_schedule_page: '//*[@id="tabmenu-sub-ul2"]/li[1]/span', //時間割検索ページ本体へのリンク
  select_faculty_departments_of_schedule_page: '//*[@id="taioJikanwariShozokuCode"]', //時間割検索ページの中の開講所属の<select>タグ
  faculty_departments_of_schedule_page: '//*[@id="taioJikanwariShozokuCode"]/option', //時間割検索ページの中の開講所属の選択肢
  iframe_of_schedule_page: '//*[@id="main-frame-if"]',
  button_to_search_schedule: '//*[@id="jikanwariReferForm"]/table/tbody/tr[9]/td/p/input[1]', //時間割検索ページの「実行」ボタン
  button_to_back: '/html/body/input', //時間割検索結果からメインに戻るボタン
  search_schedule_error: "//span[@class='error']",

  /* 時間割表の操作メニューのselectタグ */
  cource_category: '//*[@id="taioJikanwariSecchibunCode"]', //設置分類
  faculty_department: '//*[@id="taioJikanwariShozokuCode"]', //開講所属
  term: '//*[@id="gakkiKubunCode"]' //学期
};

const loyola_selector = {
  /* 時間割表の操作メニューのselectタグのid */
  cource_category: 'select#taioJikanwariSecchibunCode', //設置分類
  faculty_department: 'select#taioJikanwariShozokuCode', //開講所属
  term: 'select#gakkiKubunCode' //学期
};

const not_found_strings = "入力された条件に該当する科目は存在しません。　検索条件を変更してください。";

const schedule_page_select_value = {
  /* 時間割表の操作メニューのselectタグのvalue */
  cource_category: [ //設置分類
    { 
      name: '大学',
      id: '1',
    },
    {
      name: '大学院',
      id: '2'
    }
  ],
  term: [ //学期
    { 
      name: '春学期',
      id: '1',
    },
    { 
      name: '秋学期',
      id: '2',
    }
  ]
  // 開講所属は数が膨大なので別途取得する
};

const login = async (page) => {
  try {
    await page.goto(setting.loyola_uri, { //LOYOLAトップページに飛ぶ
      waitUntil: 'domcontentloaded',
    });

    const userNameInputHandle = page.$x(loyola_xpath.login_username);
    const passwordInputHandle = page.$x(loyola_xpath.login_password);
    const loginButtonHandle = page.$x(loyola_xpath.login_button);

    await (await userNameInputHandle)[0].type(setting.loyola_id); //学籍番号入力
    await (await passwordInputHandle)[0].type(setting.loyola_password); //パスワード入力
        
    await Promise.all([
      page.waitForNavigation({ //画面遷移待ち
        waitUntil: ["domcontentloaded", "networkidle0"],
      }),
      (await loginButtonHandle)[0].click() //ログインボタンを押す
    ]);

    console.log('Loyolaログイン完了');
  } catch (e) {
    console.log(e);
    return false;
  }
  return page; 
};

const access_schedule = async (page) => {
  try {
    const curriculum_menu_handle = await page.$x(loyola_xpath.button_of_curriculum_menu);
    await Promise.all([
      page.waitForXPath(loyola_xpath.schedule_in_header),
      //   page.waitForTimeout(3000),
      curriculum_menu_handle[0].click() //「カリキュラム」のメニューを開く
    ]);

    page.waitForTimeout(2000);
    
    const schedule_in_header_handle = await page.$x(loyola_xpath.schedule_in_header);
    await Promise.all([
      page.waitForXPath(loyola_xpath.link_to_schedule_page),
      //   page.waitForTimeout(3000),
      schedule_in_header_handle[0].click() //ヘッダの「時間割」を開く
    ]);

    await page.waitForTimeout(2000);

    const link_to_schedule_page_handle = await page.$x(loyola_xpath.link_to_schedule_page);
    await Promise.all([
      page.waitForFrame(async (frame) => frame.url().includes('scs.cl.sophia.ac.jp')),
      link_to_schedule_page_handle[0].click() //ヘッダから「時間割参照」を開いて時間割検索メニューを開く
    ]);

    await page.waitForTimeout(2000);

    console.log('時間割検索ページへのアクセス:成功');
  } catch (e) {
    console.log(e);
    return false;
  }
  return page;
};

const search_schedule = async (page) => {
  try {
    const [, iframe] = page.frames(); //現在のページが[0]に入っている（n>0なるn個目のiframeは[n]に入る）

    for (const cource_category of schedule_page_select_value.cource_category) {
      for (const term of schedule_page_select_value.term) {
        console.log(`設置分類: ${cource_category.name}, 学期: ${term.name}`);
        await iframe.select(loyola_selector.cource_category, cource_category.id); //設置分類の選択
        await iframe.select(loyola_selector.term, term.id); //学期の選択

        const faculty_departments_of_schedule_page_handle = await iframe.$x(loyola_xpath.faculty_departments_of_schedule_page); //開講所属の選択
        const list_of_faculty_departments = faculty_departments_of_schedule_page_handle.map(async (element) => {
          return {
            id: String(await (await element.getProperty('value')).jsonValue()),
            name: String(await (await element.getProperty('innerText')).jsonValue())
          };
        });
        //<select>の中の<option>を全て取得し、各々のvalue属性を取得する
        console.log(`開講所属数: ${list_of_faculty_departments.length}`);

        for await (const fd of list_of_faculty_departments) {
          console.log(`開講所属名: ${fd.name}, value: ${fd.id}`);

          const select_faculty_departments_of_schedule_page_handle = await iframe.$x(loyola_xpath.select_faculty_departments_of_schedule_page);
          await select_faculty_departments_of_schedule_page_handle[0].select(fd.id); //開講所属の選択

          const button_to_search_schedule_handle = await iframe.$x(loyola_xpath.button_to_search_schedule);
          const [response] = await Promise.all([
            iframe.waitForNavigation({ waitUntil: ["domcontentloaded", "networkidle0"] }),
            button_to_search_schedule_handle[0].click() //「実行」を押して時間割検索を開始する
          ]);

          if ((await response.text()).includes(not_found_strings)) { //異常系
            console.log('該当開講科目なし');
          } else { //正常系
            await iframe.waitForTimeout(1000);

            // await parse_schedule(page);
            //ここで検索結果をパース

            const button_to_back_handle = await iframe.$x(loyola_xpath.button_to_back);
            await Promise.all([
              iframe.waitForNavigation({ waitUntil: ["domcontentloaded", "networkidle0"] }),
              iframe.waitForTimeout(2000),
              button_to_back_handle[0].click() //検索結果から元のページに戻る
            ]);
          }
        }
      }
    }
    console.log('時間割検索の実行:成功');
  } catch (e) {
    console.log(e);
  }
  return page;
};

const parse_schedule = async (page) => {};

const schedule_to_json = () => {};

const json_to_humanreadable_table = () => {};

(async () => {
  const browser = await puppeteer.launch({
    defaultViewport: { width: 1000, height: 1000 },
    // args: [
    //   '--disable-gpu',
    //   '--disable-dev-shm-usage',
    //   '--disable-setuid-sandbox',
    //   '--no-first-run',
    //   '--no-sandbox',
    //   '--no-zygote',
    //   '--single-process'
    // ],
    // headless: true,
    headless: false,
    // devtools: true,
    timeout: 2 * 60 * 1000,
    slowMo: 100
  });
      
  try {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => { //webdriver.navigatorを消して自動操縦であることを隠す
      Object.defineProperty(navigator, 'webdriver', ()=>{});
      delete navigator.__proto__.webdriver;
    });

    await search_schedule(await access_schedule(await login(page)));
  } catch (e) {
    console.log(e);
    await browser.close();
  }

})();
