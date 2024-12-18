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

    // 处理 JSON 中的所有 path 字段，转换为完整 URL
    const processedData = JSON.parse(
      JSON.stringify(data, (key, value) => {
        if (key === 'url' && typeof value === 'string') {
          if (value.startsWith("doc://com.apple.documentation")) {
            return value.replace("doc://com.apple.documentation", "https://developer.apple.com/documentation");
          } else if (value.startsWith("/documentation")) {
            return `https://developer.apple.com${value}`;
          } else {
            return value;
          }
        }
        return value;
      })
    );

    // 保存原始处理后的 JSON 到 raw 文件夹
    const rawOutputPath = path.join(process.cwd(), 'raw', `${docName}.json`);
    await fs.ensureDir(path.dirname(rawOutputPath));
    await fs.writeJson(rawOutputPath, processedData, { spaces: 2 });

    // 提取文章和示例代码
    const results = [];

    // 处理 topicSections
    if (data.topicSections) {
      for (const section of data.topicSections) {
        if (section.identifiers) {
          for (const identifier of section.identifiers) {
            const reference = data.references[identifier];
            if (reference) {
              const result = {
                title: reference.title,
                url: reference.url?.startsWith('/')
                  ? `https://developer.apple.com${reference.url}`
                  : reference.url,
                type: reference.role,
              };

              // 如果是 collectionGroup,获取下一层数据
              if (reference.role === 'collectionGroup' && reference.url) {
                try {
                  const subUrl = reference.url.replace('/documentation/', '');
                  const subDocName = subUrl;
                  await scrapeDocJSON(subDocName);
                  result.subDoc = subDocName;
                } catch (error) {
                  console.error(`获取子文档 ${reference.url} 失败:`, error);
                }
              }

              results.push(result);
            }
          }
        }
      }
    }

    // 保存处理后的结果到 JSON 文件
    const outputPath = path.join(process.cwd(), 'data', `${docName}.json`);
    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeJson(outputPath, results, { spaces: 2 });

    console.log(`获取完成！共获取 ${results.length} 个项目`);
    console.log(`结果已保存至: ${outputPath}`);
    console.log(`原始数据已保存至: ${rawOutputPath}`);

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
