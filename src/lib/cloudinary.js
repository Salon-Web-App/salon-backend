// Cloudinary config, used by admin controllers/AdminJS hooks to upload
// staff/service photos and gallery images/videos, returning a CDN URL.
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// resourceType: 'image' | 'video' | 'auto' (auto lets Cloudinary detect it)
function uploadImageBuffer(buffer, folder, resourceType = "image") {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (err, result) => {
        if (err) return reject(err);
        resolve(result.secure_url);
      },
    );
    stream.end(buffer);
  });
}

module.exports = { uploadImageBuffer };
