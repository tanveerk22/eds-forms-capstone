# EDS Forms Capstone — Personal Loan Journey (Tier 1)

A Personal Loan application journey (OTP login → pre-approved offer → EMI
calculator → preview → submission) built on Adobe's AEM Forms Edge Delivery
Services (EDS) boilerplate, using **doc-based (sheet) Adaptive Forms** and
reusable EDS fragments. See [`DELIVERABLES.md`](./DELIVERABLES.md) for the
full capstone submission write-up (API/FDM summary, EMI explanation,
analytics events, known limitations).

## Quick Start
```sh
npm install
npx aem up
```
Open `http://localhost:3000/` and click **Apply Now**. Use mobile
`9876543210`, any DOB, and OTP `123456` for the happy path. Mobile numbers
starting with `0` simulate a "no offer" failure; any OTP other than
`123456` simulates an invalid-OTP failure.

## Project Layout
- `index.html` — the 5-step journey shell (Welcome / Login / Offer / Preview / Thank You)
- `fragments/*.plain.html` — reusable EDS fragments, each backed by its own doc-based Adaptive Form
- `forms/*.json` — doc-based (sheet) Adaptive Form field definitions (see `tools/gen/build-form-sheets.mjs` to regenerate)
- `scripts/loan-journey.js` — step controller, EMI calculation, field visibility
- `scripts/mock-api.js` — mocked InitiateCustomerIdentification / VerifyOTPAndGetDemogDetails / submission APIs
- `styles/loan-journey.css` — journey-specific styling

## Environments
<<<<<<< HEAD
- Preview: https://main--{repo}--{owner}.aem.page/
- Live: https://main--{repo}--{owner}.aem.live/

## Documentation

Before using the aem-boilerplate, we recommend you to go through the documentation on [www.aem.live](https://www.aem.live/docs/), more specifically:
1. [AEM Authoring](https://www.aem.live/docs/aem-authoring)
2. [Universal Editor Tutorial](https://www.aem.live/developer/ue-tutorial)
3. [Component Model Definitions](https://www.aem.live/developer/component-model-definitions)
4. [Authoring Path Mapping](https://www.aem.live/developer/authoring-path-mapping)

## Prerequisites

- nodejs 20 or newer
- AEM Cloud Service release 2026.4 or newer
=======
- Preview: https://main--aem-boilerplate-forms--adobe-rnd.aem.page/
- Live: https://main--aem-boilerplate-forms--adobe-rnd.aem.live/

## Documentation
Before using the aem-boilerplate, we recommand you to go through the documentation on [www.aem.live](https://www.aem.live/docs/) and [experienceleague.adobe.com](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/edge-delivery/wysiwyg-authoring/authoring), more specifically:

- [Getting Started Guide](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/edge-delivery/wysiwyg-authoring/edge-dev-getting-started)
- [Creating Blocks](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/edge-delivery/wysiwyg-authoring/create-block)
- [Content Modelling](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/edge-delivery/wysiwyg-authoring/content-modeling)
- [Working with Tabular Data / Spreadsheets](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/edge-delivery/wysiwyg-authoring/tabular-data)

Furthremore, we encourage you to watch the recordings of any of our previous presentations or sessions:
- [Getting started with AEM Forms Authoring and Edge Delivery Services](https://experienceleague.adobe.com/en/docs/events/experience-manager-gems-recordings/gems2024/edge-delivery-for-aem-forms)

## Prerequisites

- nodejs 18.3.x or newer
- AEM Cloud Service release 2024.8 or newer (>= `17465`)
>>>>>>> 0a5eac6 (chore: scaffold from aem-boilerplate-forms)

## Installation

```sh
npm i
```

## Linting

```sh
npm run lint
```
<<<<<<< HEAD
=======

## Local development

1. Create a new repository based on the `aem-boilerplate` template and add a mountpoint in the `fstab.yaml`
1. Add the [AEM Code Sync GitHub App](https://github.com/apps/aem-code-sync) to the repository
1. Install the [AEM CLI](https://github.com/adobe/helix-cli): `npm install -g @adobe/aem-cli`
1. Start AEM Proxy: `aem up` (opens your browser at `http://localhost:3000`)
1. Open the `{repo}` directory in your favorite IDE and start coding :)

## Custom Form Components

Create custom form components using the interactive scaffolder:

```sh
npm run create:custom-component
```

This will guide you through creating a new custom component with:
- Interactive prompts for component name and base type
- Automatic file generation (JS, CSS, JSON)
- Automatic integration in form block with mappings


## Updating Runtime Core

The AEM Forms runtime core libraries (`@aemforms/af-core` and `@aemforms/af-formatters`) power the form rendering and validation logic. These libraries are bundled into the project using Rollup to optimize performance and ensure compatibility.

### Update Process

1. **Find the Latest Version**
   - Navigate to the [af2-web-runtime repository](https://git.corp.adobe.com/livecycle/af2-web-runtime)
   - Check the commit history or releases for the latest versions of:
     - `@aemforms/af-core`
     - `@aemforms/af-formatters`
   - Note: Both packages should typically be updated to the same version number

2. **Update Package Dependencies**
   - Manually edit `package.json` in the `devDependencies` section
   - Update both packages to the same version:
     ```json
     "@aemforms/af-core": "x.xx.xxx",
     "@aemforms/af-formatters": "x.xx.xxx"
     ```

3. **Install Dependencies**
   ```sh
   npm install
   ```
   This will download the new versions from the npm registry.

4. **Bundle the Runtime**
   ```sh
   npm run update
   ```
   
   This command runs Rollup to bundle the updated libraries into `blocks/form/rules/model/`.

5. **Verify the Update**
   - Check that files in `blocks/form/rules/model/` have been updated
>>>>>>> 0a5eac6 (chore: scaffold from aem-boilerplate-forms)
