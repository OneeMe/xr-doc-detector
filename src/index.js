import fs from 'fs-extra';
import path from 'path';
import fetch from 'node-fetch';

// 读取文档列表
const docList = await fs.readJson(path.join(process.cwd(), 'src', 'list.json'));

async function scrapeDocJSON(docName) {
  console.log(`开始获取 ${docName} 的文档数据...`);

  try {
    // 构建 API URL
    const url = `https://developer.apple.com/tutorials/data/documentation/${docName}.json`;

    // 获取 JSON 数据
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    // 提取文章和示例代码
    const results = [];

    // 处理 topicSections
    if (data.topicSections) {
      data.topicSections.forEach(section => {
        if (section.identifiers) {
          section.identifiers.forEach(identifier => {
            const reference = data.references[identifier];
            if (reference) {
              results.push({
                title: reference.title,
                url: `https://developer.apple.com${reference.url}`,
                type: reference.role,
              });
            }
          });
        }
      });
    }

    // 保存结果到 JSON 文件
    const outputPath = path.join(process.cwd(), 'data', `${docName}.json`);
    await fs.writeJson(outputPath, results, { spaces: 2 });

    console.log(`获取完成！共获取 ${results.length} 个项目`);
    console.log(`结果已保存至: ${outputPath}`);

  } catch (error) {
    console.error(`获取 ${docName} 数据时出错:`, error);
  }
}

// 确保输出目录存在
await fs.ensureDir(path.join(process.cwd(), 'data'));

// 并行获取所有文档数据
await Promise.all(docList.map(url => {
  const docName = url.split('/').pop();
  return scrapeDocJSON(docName);
}));
