const express = require('express');
const multer = require('multer');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const app = express();
require('dotenv').config();
// Configure AWS
console.log(process.env.ACCESS_KEY)

const s3Client = new S3Client({
  region: process.env.REGION,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
  },
});

// Configure multer for file upload
const upload = multer({ storage: multer.memoryStorage() });

// Handle file upload
app.post('/api/upload', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  try {
    const params = {
      Bucket: process.env.BUCKET_NAME,
      Key: `${Date.now().toString()}-${req.file.originalname}`,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      //ACL: 'public-read',
    };

    const uploadParams = new Upload({
      client: s3Client,
      params: params,
    });

    const result = await uploadParams.done();

    res.json({ message: 'File uploaded successfully', location: result.Location });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error uploading file');
  }
});

app.get('/api/images', async (req, res) => {
  try {
    const command = new ListObjectsV2Command({
      Bucket: process.env.BUCKET_NAME,
    });

    const data = await s3Client.send(command);

    const imagePromises = data.Contents.map(async (object) => {
      const getObjectParams = {
        Bucket: process.env.BUCKET_NAME,
        Key: object.Key,
      };
      const command = new GetObjectCommand(getObjectParams);
      const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // URL expires in 1 hour

      return {
        key: object.Key,
        url: url,
      };
    });

    const images = await Promise.all(imagePromises);

    res.json(images);
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).send('Error fetching images');
  }
});

app.delete('/api/images/:key', async (req, res) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: req.params.key,
    });

    await s3Client.send(command);
    res.status(200).send('Image deleted successfully');
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).send('Error deleting image');
  }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
