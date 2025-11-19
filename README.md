# Image Overlay API

A Vercel serverless API for compositing design images onto background images.

## Endpoints

### POST /api/composite

Composites a design image onto a background image and returns a URL to the result.

**Request body:**
```json
{
  "design_url": "https://example.com/design.png",
  "background_url": "https://example.com/background.png",
  "width_percent": 50,
  "x_percent": 50,
  "y_percent": 50
}
```

**Response:**
```json
{
  "success": true,
  "image_url": "https://your-app.vercel.app/api/fetch-image?id=<uuid>"
}
```

### GET /api/fetch-image?id=<uuid>

Retrieves a previously generated composite image.

## Deployment

This API is deployed on Vercel and automatically deploys from the `main` branch.

Latest update: 2025-11-19 (print file generator added)
