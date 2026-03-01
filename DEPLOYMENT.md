# GitHub Pages Deployment Guide

## Before Running the Workflow

You must enable GitHub Pages in your repository settings **before** the workflow can deploy.

### Step 1: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** tab
3. Click **Pages** in the left sidebar
4. Under **Source**, select **GitHub Actions**
5. Click **Save**

![GitHub Pages Settings](https://docs.github.com/assets/cb-74632/images/help/pages/pages-source-actions.png)

### Step 2: Verify Workflow Configuration

The workflow (`.github/workflows/deploy-docs.yml`) is already configured with:
- MkDocs 1.x (compatible with Material theme)
- Material for MkDocs 9.x
- All required plugins
- GitHub Pages deployment

### Step 3: Trigger Deployment

After enabling GitHub Pages, push changes to trigger deployment:

```bash
git add .
git commit -m "docs: configure GitHub Pages deployment"
git push origin main
```

The workflow will automatically:
1. Install MkDocs and dependencies
2. Build the documentation
3. Deploy to GitHub Pages

### Step 4: Access Your Site

After successful deployment, your documentation will be available at:
```
https://[YOUR_USERNAME].github.io/huntarr/
```

## Troubleshooting

### Error: "Get Pages site failed"

**Cause**: GitHub Pages is not enabled or not configured to use GitHub Actions.

**Solution**: Follow Step 1 above to enable GitHub Pages with "GitHub Actions" as the source.

### Workflow completes but site is not accessible

**Cause**: First deployment may take 1-2 minutes to propagate.

**Solution**: Wait a few minutes, then refresh the page.

### 404 Error

**Cause**: Incorrect repository name or Pages not enabled.

**Solution**:
1. Verify repository name is `huntarr`
2. Verify GitHub Pages is enabled with "GitHub Actions" source
3. Check that the `site_url` in `mkdocs.yml` matches your GitHub username

## Next Steps

After deployment:
1. **Update Google Analytics** - Replace `G-XXXXXXXXXX` in `mkdocs.yml` with your GA4 Measurement ID
2. **Update URLs** - Replace `huntarr/huntarr` in `mkdocs.yml` with your actual repository
3. **Test search** - Verify the built-in search works
4. **Submit sitemap** - Add `sitemap.xml` to Google Search Console

## Additional Resources

- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [MkDocs Material Theme](https://squidfunk.github.io/mkdocs-material/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
