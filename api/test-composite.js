const sharp = require('sharp');
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  try {
    const backgroundUrl = "https://www.dropbox.com/scl/fi/vwbtt85okupf8zma4twyo/Hoodies-blanks-black.png?rlkey=msqguo7bx1weoqsmqmieu5rjq&raw=1";
    const designUrl = "https://prod-fillout-oregon-s3.s3.us-west-2.amazonaws.com/orgid-60446/flowpublicid-4d65DDspdnus/354489d7-12ac-4c59-9868-c613ad987d07-7EVSu6aoZSz46d01ilgfmliGOFUSAE5kpr2LVlknlRC1Kj7btAfJWE62RxlpN1EQiEVbxFfetvtf63YIyYunvwF8AeeV8jlDECB/bef2ad2514564f29858b19b9e6f98f5a_large_67fd97f2-4907-463d-8187-45f8f7ee3163_720x.jpg";
    
    const [backgroundResp, designResp] = await Promise.all([
      fetch(backgroundUrl),
      fetch(designUrl)
    ]);
    
    const backgroundBuffer = await backgroundResp.buffer();
    const designBuffer = await designResp.buffer();
    
    const bgMetadata = await sharp(backgroundBuffer).metadata();
    
    const widthPct = 35;
    const designWidth = Math.round(bgMetadata.width * (widthPct / 100));
    
    const resizedDesign = await sharp(designBuffer)
      .resize(designWidth, null, { fit: 'inside' })
      .toBuffer();
    
    const resizedMeta = await sharp(resizedDesign).metadata();
    
    const xPct = 50;
    const yPct = 28;
    
    const left = Math.round((bgMetadata.width * (xPct / 100)) - (resizedMeta.width / 2));
    const top = Math.round(bgMetadata.height * (yPct / 100));
    
    const outputBuffer = await sharp(backgroundBuffer)
      .composite([{
        input: resizedDesign,
        left: left,
        top: top
      }])
      .png()
      .toBuffer();
    
    res.setHeader('Content-Type', 'image/png');
    res.send(outputBuffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
