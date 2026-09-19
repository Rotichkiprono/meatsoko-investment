import { IsString, IsEnum, IsNotEmpty, Matches } from "class-validator";

export enum DocumentType {
  PASSPORT = "passport",
  NATIONAL_ID = "national_id",
  DRIVERS_LICENSE = "drivers_license",
  PROOF_OF_ADDRESS = "proof_of_address",
  CERTIFICATE_OF_INCORPORATION = "certificate_of_incorporation",
}

export class GenerateUploadUrlDto {
  @IsEnum(DocumentType, { message: "Invalid document type specified." })
  documentType: DocumentType;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9]{1,10}$/i, {
    message: "File extension must contain only alphanumeric characters.",
  })
  fileExtension: string;
}

export class SubmitKycDto {
  @IsEnum(DocumentType, { message: "Invalid document type specified." })
  documentType: DocumentType;

  @IsString()
  @IsNotEmpty()
  @Matches(/^investors\/[^/]+\/kyc\/[a-z_]+\/[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/, {
    message: "Invalid storage path structure.",
  })
  storagePath: string;
}
