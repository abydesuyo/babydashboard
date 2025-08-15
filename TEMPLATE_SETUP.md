# Baby Dashboard Template Setup Guide

This guide explains how to set up the master template sheet that users can copy to create new baby activity dashboards with full Apps Script functionality.

## Overview

The template system allows users to create new sheets that automatically include:
- ✅ Pre-built formulas for daily totals and averages
- ✅ Google Apps Script backend with web app endpoints
- ✅ Automatic sleep duration calculations
- ✅ Real-time data processing triggers
- ✅ Ready-to-use charts and summaries

## Setting Up the Master Template

### Step 1: Create the Template Sheet

1. Create a new Google Sheets document
2. Name it "Baby Dashboard Template" or similar
3. Set up the basic structure:
   - **Activities** sheet with columns: Date, Activity, Quantity
   - **Summary** sheet (optional) with daily/weekly analysis
   - **Charts** sheet (optional) with pre-built visualizations

### Step 2: Add Apps Script Code

1. Go to **Extensions** > **Apps Script**
2. Replace the default `Code.gs` content with the provided Google Apps Script code:

```javascript
/**
 * This function runs when the web app receives a GET request.
 * It logs both successes and failures and returns a specific JSON response for each case.
 */
function doGet(e) {
  // IMPORTANT: Change 'Activities' to the actual name of your sheet tab if it's different.
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Activities');
  
  try {
    // --- Main Logic & Validation ---
    const timestamp = new Date();
    const allowedValues = ["Pooped", "SleepStarted", "SleepEnded", "Formula"];
    
    const value = e.parameter.value;
    let quantity = 1;
    if (value === "Formula") {
      quantity = e.parameter.quantity;
    }

    if (value === undefined || value === null) {
      throw new Error("Validation Failed. The 'value' parameter was not provided.");
    }

    if (allowedValues.indexOf(value) === -1) {
      throw new Error("Validation Failed. Received value '" + value + "' is not allowed.");
    }
    
    // --- SUCCESS CASE ---
    const dataForSheet = [timestamp, value, quantity];
    
    // Write data to the spreadsheet
    sheet.insertRowBefore(2);
    sheet.getRange(2, 1, 1, dataForSheet.length).setValues([dataForSheet]);
    
    // Check if the special "SleepEnded" function needs to run
    processSleepEnded(sheet, 2, value);
    
    // Return a detailed success message
    return ContentService.createTextOutput(JSON.stringify({
      'status': 'success',
      'message': 'Action logged successfully.',
      'method': 'GET',
      'logged_value': value,
      'logged_quantity': quantity
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    // --- FAILURE CASE ---
    const errorTimestamp = new Date();
    const errorDataForSheet = [errorTimestamp, err.toString()];
    
    // Log the error to the spreadsheet
    sheet.insertRowBefore(2);
    sheet.getRange(2, 1, 1, errorDataForSheet.length).setValues([errorDataForSheet]);
    
    // Return a specific error message
    return ContentService.createTextOutput(JSON.stringify({
      'status': 'error',
      'message': err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ... [Include the rest of your Apps Script code here] ...
```

### Step 3: Deploy as Web App (Optional)

1. Click **Deploy** > **New Deployment**
2. Choose **Web app** as the type
3. Set **Execute as**: Me
4. Set **Who has access**: Anyone (for public template)
5. Click **Deploy**

### Step 4: Set Permissions

Make the template sheet accessible:
- **Option A**: Make it public (anyone with the link can view)
- **Option B**: Share with your service account email
- **Option C**: Share with specific users

### Step 5: Configure the App

1. Copy the Google Sheets ID from the template sheet URL
2. Set the environment variable `VITE_TEMPLATE_SHEET_ID` to this ID
3. For production: Update your hosting platform's environment variables
4. For development: Add to `.env` file:
   ```
   VITE_TEMPLATE_SHEET_ID=your_template_sheet_id_here
   ```

## Template Sheet Structure

### Activities Sheet (Required)
- **Column A**: Date (Date/Time format)
- **Column B**: Activity (Text: "Formula", "SleepStarted", "SleepEnded", "Pooped")
- **Column C**: Quantity (Number: ml for Formula, minutes for SleepEnded, 1 for others)

### Summary Sheet (Optional)
Add formulas for:
- Daily totals: `=SUMIFS(Activities.C:C, Activities.B:B, "Formula", Activities.A:A, ">=TODAY()")`
- Sleep analysis: `=SUMIFS(Activities.C:C, Activities.B:B, "SleepEnded", Activities.A:A, ">=TODAY()")`
- Weekly averages and trends

### Charts Sheet (Optional)
Create charts for:
- Daily formula intake over time
- Sleep duration patterns
- Activity frequency analysis

## Testing the Template

1. Create a test copy of your template
2. Verify all Apps Script triggers work
3. Test web app endpoints (if deployed)
4. Confirm formulas calculate correctly
5. Check that charts update with new data

## Troubleshooting

### Template Not Available
- Check the `VITE_TEMPLATE_SHEET_ID` environment variable
- Verify sheet permissions (must be readable)
- Confirm the sheet exists and is accessible

### Apps Script Not Working
- Check that the script is properly saved
- Verify all function names match the original code
- Ensure proper permissions are set
- Test the script manually in the Apps Script editor

### Permission Issues
- Make sure the template sheet has proper sharing settings
- Check that your Google account has access to the template
- Verify the Drive API scope includes file access

## Updating the Template

To update the master template:
1. Make changes to the original template sheet
2. Test all functionality still works
3. All new sheets created from template will use the updated version
4. Existing user sheets are not affected (they're independent copies)

## Multiple Templates

You can create multiple templates for different use cases:
- Basic template: Simple tracking without Apps Script
- Advanced template: Full functionality with web apps
- Custom templates: Specialized for different needs

To use multiple templates, pass the template ID as a parameter to `createSheetFromTemplate()`.